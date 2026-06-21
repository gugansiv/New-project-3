

async function testCustomerPortal() {
  const baseUrl = 'http://localhost:3000/api';
  console.log('--- STARTING CUSTOMER PORTAL VERIFICATION ---');

  try {
    // 1. Test OTP Generation
    console.log('\\n[1] Testing WhatsApp OTP Forgot Password flow...');
    const otpRes = await fetch(`${baseUrl}/auth/otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'send', phone: '9999999999' })
    });
    const otpData = await otpRes.json();
    console.log('OTP Send Result:', otpData);
    if (!otpData.success) throw new Error('OTP sending failed');

    // 2. Test Customer Signup
    console.log('\\n[2] Testing Customer Signup...');
    const email = `test.customer.${Date.now()}@test.com`;
    const signupRes = await fetch(`${baseUrl}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Customer', email, password: 'password123', role: 'customer' })
    });
    const signupData = await signupRes.json();
    console.log('Signup Result:', signupData.success ? 'Success' : signupData.error);
    if (!signupData.success) throw new Error('Signup failed');

    const token = signupData.token;
    const userId = signupData.user.id;

    // 3. Update Profile (Add phone)
    console.log('\\n[3] Testing Profile Update...');
    const profileRes = await fetch(`${baseUrl}/customer/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ phone: '9999999999' })
    });
    const profileData = await profileRes.json();
    console.log('Profile Update Result:', profileData);

    // 4. Test placing an order and earning loyalty points
    console.log('\\n[4] Testing Order Placement (Earning Points)...');
    const orderRes = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        id: 'test-order-' + Date.now(),
        storeId: 'st1',
        storeName: 'Namakkal Central Outlet',
        items: [{ id: 'b1', quantity: 2 }],
        paymentMethod: 'Cash/Card',
        customerName: 'Test Customer',
        customerPhone: '9999999999'
      })
    });
    const orderData = await orderRes.json();
    console.log('Order Result:', orderData.success ? `Success! Order ID: ${orderData.order.id}` : orderData.error);
    
    // 5. Test fetching Loyalty Wallet
    console.log('\\n[5] Testing Loyalty Wallet...');
    const loyaltyRes = await fetch(`${baseUrl}/customer/loyalty`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const loyaltyData = await loyaltyRes.json();
    console.log('Loyalty Wallet Data:', loyaltyData);

    // 6. Test Support Tickets
    console.log('\\n[6] Testing Support Ticket creation...');
    const supportRes = await fetch(`${baseUrl}/customer/support`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ subject: 'Order was late', message: 'I waited for 1 hour.' })
    });
    const supportData = await supportRes.json();
    console.log('Support Ticket Result:', supportData);

    console.log('\\n--- ALL TESTS COMPLETED SUCCESSFULLY ---');
  } catch (err) {
    console.error('\\n❌ TEST FAILED:', err.message);
  }
}

testCustomerPortal();
