import Link from "next/link";
import { getSession } from "~/lib/auth";
import { Header } from "~/components/Header";
import { headers } from "next/headers";

export default async function LandingPage() {
  const reqHeaders = await headers();
  const cookieHeader = reqHeaders.get("cookie") || undefined;
  const sessionData = await getSession(cookieHeader);
  const user = sessionData?.user || null;

  return (
    <div className="w-full relative isolate bg-[#FAFAFA] selection:bg-orange-100 selection:text-orange-900 font-sans">
      <Header user={user} />
      
      {/* ─── Brutalist Minimal Background ─── */}
      <div className="fixed inset-0 pointer-events-none -z-10 bg-[#FAFAFA]" />
      
      {/* Harder geometric grid instead of soft glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10 opacity-[0.4]" 
           style={{ backgroundImage: 'linear-gradient(to right, #E5E7EB 1px, transparent 1px), linear-gradient(to bottom, #E5E7EB 1px, transparent 1px)', backgroundSize: '6rem 6rem' }} />

      <main className="flex flex-col items-center pb-24">
        
        {/* ─── HERO SECTION ─── */}
        <section className="w-full max-w-[1200px] px-4 sm:px-6 pt-24 lg:pt-36 pb-16 md:pb-20 flex flex-col items-center text-center relative z-10">

          {/* Stark Typography */}
          <h1 className="text-5xl sm:text-6xl md:text-8xl lg:text-[8rem] font-black text-slate-950 tracking-[-0.05em] leading-[0.85] max-w-5xl mx-auto uppercase">
            Edge security <br className="hidden md:block"/>
            <span className="text-orange-500 stroke-text relative inline-block mt-2 md:mt-0">
              automated.
              {/* Sharp underline instead of glow */}
              <div className="absolute -bottom-1 md:-bottom-2 left-0 right-0 h-2 md:h-3 bg-slate-950 -z-10 translate-x-1 translate-y-1 md:translate-x-2 md:translate-y-2 opacity-10" />
            </span>
          </h1>

          <p className="mt-8 md:mt-10 text-lg sm:text-xl md:text-2xl text-slate-600 font-semibold leading-[1.6] max-w-3xl animate-fade-in-up animation-delay-100 border-l-4 border-orange-500 pl-4 sm:pl-6 text-left mx-auto md:text-center md:border-l-0 md:pl-0">
            Stop Volumetric DDoS, aggressive scrapers, and bad bots directly at the Cloudflare network layer.<br className="hidden md:block"/> Zero origin latency.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 mt-10 md:mt-14 animate-fade-in-up animation-delay-200 w-full sm:w-auto">
            <Link
              href={user ? "/dashboard" : "/register"}
              className="group relative flex items-center justify-center bg-orange-500 text-slate-950 text-[14px] sm:text-[15px] font-black px-8 sm:px-10 h-12 sm:h-14 border-2 border-slate-950 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] transition-all hover:translate-y-0.5 hover:shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-y-1.5 active:shadow-none uppercase tracking-widest w-full sm:w-auto"
            >
              Start Filtering
              <svg className="w-5 h-5 ml-3 transition-transform group-hover:translate-x-1 hidden sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
            
            <a 
              href="https://github.com/iamrknain/flarestack" target="_blank" rel="noreferrer"
              className="flex items-center justify-center gap-2 sm:gap-3 bg-white text-slate-900 text-[14px] sm:text-[15px] font-black px-8 sm:px-10 h-12 sm:h-14 border-2 border-slate-900 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] transition-all hover:bg-slate-50 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-y-1.5 active:shadow-none uppercase tracking-widest w-full sm:w-auto"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
              GitHub
            </a>
          </div>
        </section>

        {/* ─── TECHNICAL VISUALIZATION ─── */}
        <section className="w-full max-w-[1000px] px-4 sm:px-6 py-10 md:py-16">
          <div className="bg-white border-[3px] border-slate-900 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] md:shadow-[12px_12px_0px_0px_rgba(15,23,42,1)] relative overflow-hidden flex flex-col items-center">
            
            {/* Top orange warning stripes */}
            <div className="absolute top-0 left-0 right-0 h-4 bg-[repeating-linear-gradient(-45deg,#fed7aa,#fed7aa_12px,transparent_12px,transparent_24px)] border-b-[3px] border-slate-900" />
            
            {/* Background faint grid */}
            <div className="absolute inset-0 top-4 opacity-50" style={{ backgroundImage: 'linear-gradient(to right, #f1f5f9 2px, transparent 2px), linear-gradient(to bottom, #f1f5f9 2px, transparent 2px)', backgroundSize: '3rem 3rem' }} />

            <div className="relative w-full py-16 md:py-24 flex flex-col md:flex-row items-center justify-center gap-12 md:gap-8 z-10">
              
              {/* Desktop Horizontal Connecting Line (behind) & Packets */}
              <div className="hidden md:block absolute top-1/2 left-[15%] right-[15%] h-[0px] border-t-4 border-dashed border-slate-300/80 -translate-y-1/2 -z-10">
                {/* INCOMING */}
                <div className="absolute top-1/2 left-[10%] w-3 h-3 bg-slate-900 animate-[ping-pong-clean_2s_ease-in-out_infinite] -translate-y-1/2" />
                <div className="absolute top-1/2 left-[30%] w-3 h-3 bg-orange-500 animate-[ping-pong-clean_2.5s_ease-in-out_infinite_0.5s] -translate-y-1/2" />
                <div className="absolute top-1/2 left-[10%] w-3 h-3 bg-red-600 animate-[ping-pong-block-clean_1.8s_ease-in_infinite_0.2s] -translate-y-1/2" />
                
                {/* OUTGOING (passed traffic) */}
                <div className="absolute top-1/2 left-[55%] w-3 h-3 bg-orange-500 animate-[ping-pong-clean-right_2.5s_ease-in-out_infinite_0.7s] -translate-y-1/2" />
              </div>

              {/* Mobile Vertical Connecting Line (behind) & Packets */}
              <div className="md:hidden absolute left-1/2 top-[10%] bottom-[10%] w-[0px] border-l-4 border-dashed border-slate-300/80 -translate-x-1/2 -z-10">
                {/* INCOMING */}
                <div className="absolute left-1/2 top-[10%] w-2.5 h-2.5 bg-slate-900 animate-[ping-pong-y_2s_ease-in-out_infinite] -translate-x-1/2" />
                <div className="absolute left-1/2 top-[30%] w-2.5 h-2.5 bg-orange-500 animate-[ping-pong-y_2.5s_ease-in-out_infinite_0.5s] -translate-x-1/2" />
                <div className="absolute left-1/2 top-[10%] w-2.5 h-2.5 bg-red-600 animate-[ping-pong-block-y_1.8s_ease-in_infinite_0.2s] -translate-x-1/2" />

                {/* OUTGOING (passed traffic) */}
                <div className="absolute left-1/2 top-[55%] w-2.5 h-2.5 bg-orange-500 animate-[ping-pong-y-right_2.5s_ease-in-out_infinite_0.7s] -translate-x-1/2" />
              </div>

              {/* Cloudflare Edge */}
              <div className="flex flex-col items-center gap-4 w-40">
                <div className="w-16 h-16 bg-white border-[3px] border-slate-900 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] flex items-center justify-center">
                  <svg className="w-7 h-7 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" strokeLinejoin="miter">
                    <path d="M5.05 8.949a10 10 0 0113.9 0M8.586 12.485a5 5 0 016.828 0M12 16.5h.01" strokeWidth="3" />
                  </svg>
                </div>
                <div className="text-center font-black text-slate-900 uppercase tracking-[0.15em] text-[10px] md:text-[11px] leading-snug">
                  Cloudflare<br/>Edge
                </div>
              </div>

              {/* FlareStack Engine */}
              <div className="relative w-[14rem] md:w-[15rem] h-32 md:h-36 shrink-0 mx-0 md:mx-6 group">
                {/* Orange Shadow Div (solid orange block underneath) */}
                <div className="absolute inset-0 bg-orange-500 translate-x-3 translate-y-3 sm:translate-x-4 sm:translate-y-4" />
                
                {/* Main Dark Box */}
                <div className="absolute inset-0 bg-[#0B1221] flex flex-col items-center justify-between py-6 sm:py-7 z-10 border border-slate-800">
                  <span className="text-[10px] sm:text-[11px] font-black text-white uppercase tracking-[0.15em] whitespace-nowrap">
                    FlareStack Engine
                  </span>
                  
                  {/* Equalizer */}
                  <div className="flex items-end gap-2.5 h-6">
                    <div className="w-2.5 bg-slate-500 h-[35%] animate-[equalizer_1s_ease-in-out_infinite]" />
                    <div className="w-2.5 bg-orange-500 h-[100%] animate-[equalizer_1.2s_ease-in-out_infinite]" />
                    <div className="w-2.5 bg-slate-500 h-[25%] animate-[equalizer_0.9s_ease-in-out_infinite]" />
                    <div className="w-2.5 bg-slate-500 h-[45%] animate-[equalizer_1.4s_ease-in-out_infinite]" />
                  </div>
                </div>
              </div>

              {/* Origin Server */}
              <div className="flex flex-col items-center gap-4 w-40">
                <div className="w-16 h-16 bg-white border-[3px] border-slate-900 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] flex items-center justify-center">
                  <svg className="w-7 h-7 text-slate-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" strokeLinejoin="miter">
                    <rect x="4" y="6" width="16" height="4" />
                    <rect x="4" y="14" width="16" height="4" />
                    <line x1="8" y1="8" x2="10" y2="8" />
                    <line x1="8" y1="16" x2="10" y2="16" />
                  </svg>
                </div>
                <div className="text-center font-black text-slate-900 uppercase tracking-[0.15em] text-[10px] md:text-[11px] leading-snug">
                  Your Origin<br/>Server
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ─── FEATURES GRID (Brutalist Style) ─── */}
        <section className="w-full max-w-[1200px] px-4 sm:px-6 py-16 md:py-24 lg:py-32 relative">
          
          <div className="text-left md:text-center max-w-3xl mx-auto mb-12 md:mb-20 border-l-4 border-slate-900 pl-5 md:border-l-0 md:pl-0">
            <h2 className="text-3xl sm:text-4xl md:text-6xl font-black text-slate-950 tracking-[-0.03em] mb-4 md:mb-8 uppercase leading-[1.1]">Built for scale. </h2>
            <p className="text-lg sm:text-xl text-slate-600 font-semibold leading-relaxed">
              FlareStack leverages Cloudflare's global network, running lightweight Worker scripts that add zero noticeable latency.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            
            {/* Feature 1 */}
            <div className="bg-white p-6 sm:p-8 border-2 border-slate-900 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] hover:shadow-[10px_10px_0px_0px_rgba(249,115,22,1)] hover:-translate-y-1 transition-all duration-200">
               <div className="w-12 h-12 sm:w-14 sm:h-14 bg-slate-900 text-orange-500 flex items-center justify-center mb-6 sm:mb-8 border-2 border-slate-900 shadow-[4px_4px_0px_0px_rgba(249,115,22,1)]">
                 <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                   <path strokeLinecap="square" strokeLinejoin="miter" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                 </svg>
               </div>
               <h3 className="text-lg sm:text-xl font-black text-slate-950 mb-3 sm:mb-4 uppercase tracking-wide">Automated IP Ban Lists</h3>
               <p className="text-[15px] sm:text-[16px] text-slate-600 leading-[1.7] font-medium">Dynamically detect IP addresses exceeding abusive request thresholds and automatically add them to Cloudflare WAF lists. Say goodbye to manual whack-a-mole.</p>
            </div>

            {/* Feature 2: Future Scope */}
            <div className="bg-white p-6 sm:p-8 border-2 border-slate-900 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] hover:shadow-[10px_10px_0px_0px_rgba(249,115,22,1)] hover:-translate-y-1 transition-all duration-200">
               <div className="w-12 h-12 sm:w-14 sm:h-14 bg-slate-900 text-orange-500 flex items-center justify-center mb-6 sm:mb-8 border-2 border-slate-900 shadow-[4px_4px_0px_0px_rgba(249,115,22,1)]">
                 <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                   <path strokeLinecap="square" strokeLinejoin="miter" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                 </svg>
               </div>
               <div className="flex flex-wrap items-center gap-3 mb-3 sm:mb-4">
                 <h3 className="text-lg sm:text-xl font-black text-slate-950 uppercase tracking-wide">Bot & Scraper Defense</h3>
                 <span className="text-[9px] sm:text-[10px] font-black tracking-widest uppercase bg-orange-500 text-slate-950 px-2 py-1 border border-slate-900 leading-none">Coming Soon</span>
               </div>
               <p className="text-[15px] sm:text-[16px] text-slate-600 leading-[1.7] font-medium">Issue targeted JavaScript or Managed Challenges to specific User-Agents, ASNs, or complex patterns without blocking legitimate crawlers.</p>
            </div>

            {/* Feature 3: Analytics */}
            <div className="bg-white p-6 sm:p-8 border-2 border-slate-900 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] hover:shadow-[10px_10px_0px_0px_rgba(249,115,22,1)] hover:-translate-y-1 transition-all duration-200">
               <div className="w-12 h-12 sm:w-14 sm:h-14 bg-slate-900 text-orange-500 flex items-center justify-center mb-6 sm:mb-8 border-2 border-slate-900 shadow-[4px_4px_0px_0px_rgba(249,115,22,1)]">
                 <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                   <path strokeLinecap="square" strokeLinejoin="miter" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                 </svg>
               </div>
               <h3 className="text-lg sm:text-xl font-black text-slate-950 mb-3 sm:mb-4 uppercase tracking-wide">Real-time Telemetry</h3>
               <p className="text-[15px] sm:text-[16px] text-slate-600 leading-[1.7] font-medium">Pull rich GraphQL analytics directly from Cloudflare's edge logs. See exactly which rules triggered, why, and rollback false positives instantly.</p>
            </div>

          </div>
        </section>

      </main>

      {/* Brutalist Animation Keyframes */}
      <style>{`
        @keyframes ping-pong-clean {
          0%, 100% { left: 10%; opacity: 0; }
          40% { opacity: 1; transform: translateY(-50%) scale(1.1); }
          50% { left: 45%; opacity: 0; }
        }
        @keyframes ping-pong-block-clean {
          0% { left: 10%; opacity: 0; }
          20% { opacity: 1; transform: translateY(-50%) scale(1); }
          40% { left: 43%; opacity: 1; transform: translateY(-50%) scale(1.4); }
          50% { left: 44%; opacity: 0; transform: translateY(-50%) scale(0.8); }
          100% { left: 45%; opacity: 0; }
        }
        @keyframes ping-pong-clean-right {
          0%, 100% { left: 55%; opacity: 0; }
          40% { opacity: 1; transform: translateY(-50%) scale(1.1); }
          50% { left: 90%; opacity: 0; }
        }
        @keyframes ping-pong-y {
          0%, 100% { top: 10%; opacity: 0; }
          40% { opacity: 1; transform: translateX(-50%) scale(1.1); }
          50% { top: 45%; opacity: 0; }
        }
        @keyframes ping-pong-block-y {
          0% { top: 10%; opacity: 0; }
          20% { opacity: 1; transform: translateX(-50%) scale(1); }
          40% { top: 43%; opacity: 1; transform: translateX(-50%) scale(1.4); }
          50% { top: 44%; opacity: 0; transform: translateX(-50%) scale(0.8); }
          100% { top: 45%; opacity: 0; }
        }
        @keyframes ping-pong-y-right {
          0%, 100% { top: 55%; opacity: 0; }
          40% { opacity: 1; transform: translateX(-50%) scale(1.1); }
          50% { top: 90%; opacity: 0; }
        }
        @keyframes equalizer {
          0%, 100% { transform: scaleY(0.5); }
          50% { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}
