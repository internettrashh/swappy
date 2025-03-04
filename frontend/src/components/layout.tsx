import Nav from './nav';


interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {


  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0e17] to-[#0a1a2a] flex flex-col relative">
      {/* Background Grid Effect */}
      <div 
        className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1650803321892-efba59b28a60?q=80&w=2070?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80')] opacity-10 bg-no-repeat bg-cover pointer-events-none" 
        style={{ backgroundBlendMode: 'overlay' }}
      />
      
      {/* Content */}
      <Nav />
      <main className="container mx-auto px-4 relative">
        {children}
      </main>
    </div>
  );
} 