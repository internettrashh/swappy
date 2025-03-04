'use client'

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PrivyProvider } from '@privy-io/react-auth';
import Nav from '@/components/nav'
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});



export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <title>Swappy - DeFi Made Simple</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body
      
      >
        <PrivyProvider
          appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ''}
          config={{
            // Display email and wallet as login methods
            loginMethods: ['email', 'wallet'],
            // Customize Privy's appearance in your app
            appearance: {
              theme: 'dark',
              accentColor: '#5edfff',
            },
            // Create embedded wallets for users who don't have a wallet
            embeddedWallets: {
              createOnLogin: 'users-without-wallets',
            },
            defaultChain: {
              id: 10143,
              name: 'Monad Testnet',
              rpcUrls: {
                default: {
                  http: ['https://testnet-rpc.monad.xyz'],
                },
              },
              nativeCurrency: {
                name: 'Monad',
                symbol: 'MONAD',
                decimals: 18,
              },
              blockExplorers: {
                default: {
                  name: 'Monad Explorer',
                  url: 'https://testnet.monad.xyz/explorer',
                },
              },
            },
            supportedChains: [
              {
                id: 10143,
                name: 'Monad Testnet',
                rpcUrls: {
                  default: {
                    http: ['https://testnet-rpc.monad.xyz'],
                  },
                },
                nativeCurrency: {
                  name: 'Monad',
                  symbol: 'MONAD',
                  decimals: 18,
                },
                blockExplorers: {
                  default: {
                    name: 'Monad Explorer',
                    url: 'https://testnet.monad.xyz/explorer',
                  },
                },
              }
            ],
          }}
        >
            <div className="min-h-screen bg-gradient-to-b from-[#0a0e17] to-[#0a1a2a] flex flex-col relative">
            <div 
              className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1650803321892-efba59b28a60?q=80&w=2070?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80')] opacity-10 bg-no-repeat bg-cover pointer-events-none" 
              style={{ backgroundBlendMode: 'overlay' }}
            />
            <Nav />
            <main className="container mx-auto px-4 relative">
              {children}
            </main>
          </div>
        </PrivyProvider>
      </body>
    </html>
  );
}
