import Nav from './nav';
import { Moon, Settings, HelpCircle, ArrowRightLeft, Timer, TrendingDown, Zap } from 'lucide-react';



interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-[#1c2127] text-gray-200">
      {/* Content */}
      <Nav />
      <main className="container mx-auto px-4 relative">
        {children}
      </main>
    </div>
  );
}
