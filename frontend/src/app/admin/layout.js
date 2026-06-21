export const metadata = {
  title: "Admin Panel - Crispy Chicken Co",
  description: "Administrative order management, store configuration, and financial bookkeeping portal.",
};

export default function AdminLayout({ children }) {
  return (
    <div className="min-h-screen bg-neutral-100 antialiased flex flex-col font-sans">
      {children}
    </div>
  );
}
