export const metadata = {
  title: 'YouTube AI Summarizer',
  description: 'Easily summarize YouTube videos using AI.',
};

import './globals.css';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="animated-background">
          <video 
            autoPlay 
            loop 
            muted 
            playsInline 
            className="bg-video"
          >
            <source src="/121787-724719748.mp4" type="video/mp4" />
          </video>
          <div className="bg-overlay"></div>
        </div>
        {children}
      </body>
    </html>
  );
}
