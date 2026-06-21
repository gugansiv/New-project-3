import { NextResponse } from 'next/server';
import { pool } from '../../db/db-helper';
import { withRBAC, ROLES } from '../../auth/rbac';

// Only SUPER_ADMIN and REGIONAL_MANAGER can view/process payroll
async function getPayrollHandler(req) {
  try {
    const storeId = req.nextUrl.searchParams.get('storeId');
    let queryParams = [];
    
    // Base query for shifts joined with staff_rota to calculate pay
    let query = `
      SELECT 
        s.id as shift_id,
        s."storeId",
        s."staffName",
        s."clockIn",
        s."clockOut",
        s.date,
        r."hourlyRate",
        r.role
      FROM shifts s
      JOIN staff_rota r ON s."staffName" = r.name AND s."storeId" = r."storeId"
      WHERE s."clockOut" IS NOT NULL
    `;

    if (storeId) {
      query += ` AND s."storeId" = $1`;
      queryParams.push(storeId);
    }

    const { rows } = await pool.query(query, queryParams);

    // Calculate total hours and pay per shift
    const processedPayroll = rows.map(shift => {
      const clockIn = new Date(shift.clockIn);
      const clockOut = new Date(shift.clockOut);
      const hoursWorked = (clockOut - clockIn) / (1000 * 60 * 60);
      const totalPay = hoursWorked * (shift.hourlyRate || 0);

      return {
        ...shift,
        hoursWorked: hoursWorked.toFixed(2),
        totalPay: totalPay.toFixed(2)
      };
    });

    // Group by staff member
    const summaryByStaff = processedPayroll.reduce((acc, shift) => {
      const key = `${shift.storeId}_${shift.staffName}`;
      if (!acc[key]) {
        acc[key] = {
          storeId: shift.storeId,
          staffName: shift.staffName,
          role: shift.role,
          hourlyRate: shift.hourlyRate,
          totalHours: 0,
          totalPay: 0,
          shifts: []
        };
      }
      acc[key].totalHours += parseFloat(shift.hoursWorked);
      acc[key].totalPay += parseFloat(shift.totalPay);
      acc[key].shifts.push(shift);
      return acc;
    }, {});

    return NextResponse.json(Object.values(summaryByStaff));
  } catch (error) {
    console.error('Payroll Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const GET = withRBAC([ROLES.SUPER_ADMIN, ROLES.REGIONAL_MANAGER], getPayrollHandler);
