import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

// ── useInView ─────────────────────────────────────────────────────────────────
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

// ── graph node/edge definitions ───────────────────────────────────────────────
const NODES: Record<string, { x: number; y: number; label: string }> = {
  profit:          { x: 30,  y: 185, label: 'Profit' },
  gross_profit:    { x: 220, y: 130, label: 'Gross Profit' },
  op_expense:      { x: 220, y: 290, label: 'Op. Expense' },
  revenue:         { x: 410, y: 75,  label: 'Revenue' },
  cogs:            { x: 410, y: 230, label: 'COGS' },
  product_rev:     { x: 590, y: 30,  label: 'Product Rev.' },
  service_rev:     { x: 590, y: 120, label: 'Service Rev.' },
  material_cost:   { x: 590, y: 195, label: 'Material Cost' },
  logistics_cost:  { x: 590, y: 285, label: 'Logistics Cost' },
};

// edges: [source (child), target (parent)] - arrow flows right to left
const EDGES: [string, string][] = [
  ['gross_profit',   'profit'],
  ['op_expense',     'profit'],
  ['revenue',        'gross_profit'],
  ['cogs',           'gross_profit'],
  ['product_rev',    'revenue'],
  ['service_rev',    'revenue'],
  ['material_cost',  'cogs'],
  ['logistics_cost', 'cogs'],
];

// ── scenarios ─────────────────────────────────────────────────────────────────
const now   = new Date();
const MONTH = now.toLocaleString('default', { month: 'long' });
const YEAR  = now.getFullYear();

interface Scenario {
  question: string;
  highlight: string[];
  dimmed: string[];
  tool: string;
  response: string;
}

const SCENARIOS: Scenario[] = [
  {
    question: `What is our gross profit in ${MONTH} ${YEAR}?`,
    highlight: ['gross_profit'],
    dimmed: ['product_rev', 'service_rev', 'material_cost', 'logistics_cost', 'op_expense'],
    tool: 'get_data_by_period',
    response: `Gross Profit for ${MONTH} ${YEAR} is **$58,000**.\n\nMonth-over-month it's down **−9.4%**, though year-over-year it's up **+86.5%** — a strong long-term trend despite the recent dip.`,
  },
  {
    question: 'What drives our revenue?',
    highlight: ['revenue', 'product_rev', 'service_rev'],
    dimmed: ['cogs', 'material_cost', 'logistics_cost', 'op_expense', 'profit'],
    tool: 'get_metric_components',
    response: `Revenue is composed of two streams:\n\n• **Product Revenue** — $83,000 (80% of total)\n• **Service Revenue** — $21,000 (20% of total)\n\nProduct Revenue is the dominant driver. A 1% shift there moves total revenue by ~$830.`,
  },
  {
    question: 'If COGS increases, what gets affected?',
    highlight: ['cogs', 'gross_profit', 'profit'],
    dimmed: ['revenue', 'product_rev', 'service_rev', 'op_expense'],
    tool: 'get_metric_dependents',
    response: `COGS feeds into the following with a **negative** impact:\n\n• **Gross Profit** (direct, −1×) — every $1 increase in COGS reduces Gross Profit by $1\n• **Profit** (indirect, −1×) — the effect propagates up through Gross Profit\n\nCurrent COGS is $46,000. Watch **Material Cost** ($10,700) and **Logistics Cost** ($8,900) as the main levers.`,
  },
];

// ── SVG graph ─────────────────────────────────────────────────────────────────
const NODE_W = 140;
const NODE_H = 54;

function DemoGraph({ highlight, dimmed }: { highlight: string[]; dimmed: string[] }) {
  const nodeStyle = (id: string) => {
    if (highlight.includes(id)) return { fill: '#eef2ff', stroke: '#6366f1', sw: 2,   text: '#4338ca', fw: '600' };
    return                             { fill: '#ffffff', stroke: '#9CA3AF', sw: 1,   text: '#6b7280', fw: '400' };
  };

  const edgeStyle = (src: string, tgt: string) => {
    if (highlight.includes(src) && highlight.includes(tgt)) return { stroke: '#a5b4fc', w: 2 };
    if (dimmed.includes(src) || dimmed.includes(tgt))       return { stroke: '#f3f4f6', w: 1 };
    return                                                         { stroke: '#e0e7ff', w: 1.5 };
  };

  return (
    <svg viewBox="0 0 620 340" width="100%" height="100%" style={{ overflow: 'visible' }}>
      {/* edges - bezier curves */}
      {EDGES.map(([src, tgt]) => {
        const s = NODES[src];
        const t = NODES[tgt];
        const es = edgeStyle(src, tgt);
        // connect right edge of target node to left edge of source node
        const x1 = t.x + NODE_W;
        const y1 = t.y + NODE_H / 2;
        const x2 = s.x;
        const y2 = s.y + NODE_H / 2;
        const mx = (x1 + x2) / 2;
        return (
          <path
            key={`${src}-${tgt}`}
            d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
            fill="none"
            stroke={es.stroke}
            strokeWidth={es.w}
            style={{ transition: 'stroke 0.4s ease, stroke-width 0.3s ease' }}
          />
        );
      })}

      {/* nodes */}
      {Object.entries(NODES).map(([id, { x, y, label }]) => {
        const s = nodeStyle(id);
        return (
          <g key={id} style={{ transition: 'opacity 0.4s ease' }} opacity={dimmed.includes(id) ? 0.5 : 1}>
            <rect
              x={x} y={y} width={NODE_W} height={NODE_H} rx={7}
              fill={s.fill} stroke={s.stroke} strokeWidth={s.sw}
              style={{ transition: 'fill 0.35s ease, stroke 0.35s ease' }}
            />
            <text
              x={x + NODE_W / 2} y={y + NODE_H / 2 + 4}
              textAnchor="middle" fontSize={14} fill={s.text}
              fontFamily="DM Sans, sans-serif" fontWeight={s.fw}
              style={{ transition: 'fill 0.35s ease' }}
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── streaming text ────────────────────────────────────────────────────────────
function useStream(text: string, active: boolean, speed = 13) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed('');
    setDone(false);
    if (!active || !text) return;
    let i = 0;
    const iv = setInterval(() => {
      i += 1;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) { clearInterval(iv); setDone(true); }
    }, speed);
    return () => clearInterval(iv);
  }, [text, active, speed]);

  return { displayed, done };
}

// renders **bold** markdown inline
function StreamText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/).map((chunk, i) =>
        chunk.startsWith('**') && chunk.endsWith('**')
          ? <strong key={i} className="text-gray-900 font-semibold">{chunk.slice(2, -2)}</strong>
          : <span key={i}>{chunk}</span>
      )}
    </>
  );
}

// ── hero demo widget ──────────────────────────────────────────────────────────
function HeroDemo() {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [phase, setPhase]         = useState<'idle' | 'ready'>('idle');

  const scenario = activeIdx !== null ? SCENARIOS[activeIdx] : null;
  const { displayed, done } = useStream(scenario?.response ?? '', phase === 'ready', 13);

  const handleSelect = useCallback((idx: number) => {
    setActiveIdx(idx);
    setPhase('idle');
    setTimeout(() => setPhase('ready'), 350);
  }, []);

  const highlight = phase === 'ready' && activeIdx !== null ? SCENARIOS[activeIdx].highlight : [];
  const dimmed    = phase === 'ready' && activeIdx !== null ? SCENARIOS[activeIdx].dimmed    : [];

  return (
    <div className="mt-14 rounded-2xl border border-gray-200 shadow-xl shadow-gray-100/80 bg-white overflow-hidden">
      {/* two-column */}
      <div className="flex flex-col lg:flex-row" style={{ minHeight: 470 }}>

        {/* graph pane */}
        <div className="flex-1 p-8 flex items-center justify-start bg-gray-50/50 border-b lg:border-b-0 lg:border-r border-gray-100">
          <div className="w-full" style={{ maxWidth: 480 }}>
            <DemoGraph highlight={highlight} dimmed={dimmed} />
          </div>
        </div>

        {/* chat pane */}
        <div className="w-full lg:w-72 flex flex-col shrink-0">

          {/* question pills */}
          <div className="px-4 pt-4 pb-3 border-b border-gray-300">
            <p className="text-[10px] font-semibold text-gray-800 uppercase tracking-widest mb-2">Ask a question</p>
            <div className="flex flex-col gap-1.5">
              {SCENARIOS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSelect(i)}
                  className={`text-left text-xs px-3 py-2 rounded-lg border transition-all duration-200 leading-snug ${
                    activeIdx === i
                      ? 'border-indigo-300 bg-indigo-50 text-indigo-700 font-medium'
                      : 'border-gray-200 border-2 bg-white text-gray-600 hover:border-indigo-200 hover:text-black'
                  }`}
                >
                  {s.question}
                </button>
              ))}
            </div>
          </div>

          {/* response area */}
          <div className="flex-1 px-4 py-4 overflow-y-auto">
            {activeIdx === null ? (
              <p className="text-xs text-gray-700 leading-relaxed mt-1">
                Click a question above to see the AI assistant respond and highlight the graph in real time.
              </p>
            ) : (
              <div className="space-y-2">
                {/* tool badge */}
                {phase === 'ready' && (
                  <div className="inline-flex items-center gap-1.5 text-[10px] bg-amber-50 border-l-2 border-amber-400 px-2 py-1 rounded text-amber-700 font-mono">
                    🔧 {scenario!.tool}
                  </div>
                )}
                {/* streaming text */}
                {phase === 'ready' && (
                  <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">
                    <StreamText text={displayed} />
                    {!done && (
                      <span className="inline-block w-1.5 h-3 bg-indigo-400 ml-0.5 rounded-sm align-middle"
                        style={{ animation: 'pulse 1s ease-in-out infinite' }} />
                    )}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* bottom bar */}
      <div className="border-t border-gray-100 px-5 py-2.5 flex items-center gap-2 bg-white/70">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
        <span className="text-[10px] text-gray-400">Simulated demo</span>
      </div>
    </div>
  );
}

// ── static data ───────────────────────────────────────────────────────────────
const FEATURES = [
  { icon: '⌬', title: 'Interactive Calculation Tree',    desc: 'Navigate your reports as a live React Flow graph. Click any node and detail cards will pop up.' },
  { icon: '↕', title: 'Ancestor & Descendant Traversal', desc: 'Four selection modes let you instantly isolate a node, everything that feeds into it, everything it affects, or both at once.' },
  { icon: '✦', title: 'AI Assistant with Tool Calling',    desc: 'Ask in plain English. The assistant fetches real numbers, highlights relevant nodes, and surfaces insights - all in one turn.' },
  { icon: '◈', title: 'Bring Your Own Key',              desc: 'Your API key lives only in session memory and never persisted server-side. Switch between providers freely.' },
  { icon: '◎', title: 'Multiple AI Providers', desc: 'Connect with Anthropic or OpenAI. More providers coming soon.' },
  { icon: '⏱', title: 'Multi-Period Analysis',           desc: "Filter any period in one click." },
];

const STACK = [
  { name: 'React',        role: 'UI & graph rendering',  color: '#61DAFB' },
  { name: 'React Flow',   role: 'Calculation tree',       color: '#FF4785' },
  { name: 'FastAPI',      role: 'Streaming backend',      color: '#009688' },
  { name: 'LangGraph',    role: 'Agentic AI loop',        color: '#6366f1' },
  { name: 'LangChain',    role: 'LLM abstraction',        color: '#10b981' },
  { name: 'SQLite',       role: 'Financial data store',   color: '#f59e0b' },
  { name: 'Tailwind CSS', role: 'Styling',                color: '#38bdf8' },
  { name: 'Zustand',      role: 'State management',       color: '#e879f9' },
];

function Section({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const { ref, visible } = useInView();
  return (
    <div ref={ref} className={`transition-all duration-700 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}>
      {children}
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────
export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=DM+Serif+Display:ital@0;1&display=swap');
      `}</style>

      {/* NAV */}
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="text-2xl font-semibold tracking-tight text-gray-800">
            clari<span className="text-indigo-500">tree</span>
          </span>
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <a href="#features" className="hover:text-gray-900 transition-colors">Features</a>
            <a href="#stack"    className="hover:text-gray-900 transition-colors">Stack</a>
            <a href="#about"    className="hover:text-gray-900 transition-colors">About</a>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full text-xs font-medium transition-colors"
            >
              Open App →
            </button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="max-w-5xl mx-auto px-6 pt-24 pb-16">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-medium mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            Accounting Analytics
          </div>
          <h1 className="text-5xl leading-[1.1] font-normal mb-6 text-gray-900" style={{ fontFamily: "'DM Serif Display', serif" }}>
            Understand your<br />
            <em className="text-indigo-500 not-italic">financials</em>, visually.
          </h1>
          <p className="text-lg text-gray-500 leading-relaxed mb-10 font-light">
            An interactive calculation tree paired with an AI assistant that reads real numbers,
            highlights what matters, and answers in plain English.
          </p>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="px-10 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-all hover:shadow-lg hover:shadow-indigo-200 active:scale-95"
            >
              Open App
            </button>
            <a href="#demo" className="bg-white px-6 py-3 text-gray-600 hover:text-gray-900 rounded-xl border border-gray-300 hover:border-gray-700 transition-colors font-medium text-sm">
              Watch walkthrough ↓
            </a>
          </div>
        </div>

        <HeroDemo />
      </section>

      {/* VIDEO DEMO */}
      <section id="demo" className="max-w-5xl mx-auto px-6 py-20">
        <Section>
          <div className="text-center mb-10">
            <h2 className="text-3xl font-normal text-gray-900 mb-3" style={{ fontFamily: "'DM Serif Display', serif" }}>See it in action</h2>
            <p className="text-gray-500 text-sm">A full walkthrough of the app</p>
          </div>
          <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-lg bg-gray-900 aspect-video flex items-center justify-center relative">
            <div className="text-center space-y-3 relative z-10">
              <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto border border-white/20">
                <span className="text-white text-2xl ml-1">▶</span>
              </div>
              <p className="text-white/40 text-sm">Video demo coming soon</p>
            </div>
            <div className="absolute inset-0 opacity-5" style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.3) 1px, transparent 1px)',
              backgroundSize: '40px 40px'
            }} />
          </div>
        </Section>
      </section>

      {/* FEATURES */}
      <section id="features" className="max-w-5xl mx-auto px-6 py-20">
        <Section>
          <div className="mb-12">
            <h2 className="text-3xl font-normal text-gray-900 mb-3" style={{ fontFamily: "'DM Serif Display', serif" }}>What it does</h2>
            <p className="text-gray-500 text-sm max-w-md">Built to make financial calculation trees understandable <br/> not just queryable.</p>
          </div>
        </Section>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => {
            const { ref, visible } = useInView();
            return (
              <div
                key={f.title} ref={ref}
                style={{ transitionDelay: `${i * 60}ms` }}
                className={`transition-all duration-500 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'} group p-5 rounded-xl border border-gray-100 bg-white hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-50`}
              >
                <div className="text-2xl mb-3 text-indigo-400 group-hover:text-indigo-500 transition-colors">{f.icon}</div>
                <h3 className="font-semibold text-gray-800 text-sm mb-2">{f.title}</h3>
                <p className="text-gray-500 text-xs leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* STACK */}
      <section id="stack" className="max-w-5xl mx-auto px-6 py-20">
        <Section>
          <div className="mb-12">
            <h2 className="text-3xl font-normal text-gray-900 mb-3" style={{ fontFamily: "'DM Serif Display', serif" }}>Built with</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {STACK.map((s) => (
              <div key={s.name} className="p-4 rounded-xl border border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm transition-all">
                <div className="w-2 h-2 rounded-full mb-3" style={{ backgroundColor: s.color }} />
                <p className="font-semibold text-gray-800 text-sm">{s.name}</p>
                <p className="text-gray-400 text-xs mt-0.5">{s.role}</p>
              </div>
            ))}
          </div>
        </Section>
      </section>

      {/* ABOUT */}
      <section id="about" className="max-w-5xl mx-auto px-6 py-20">
        <Section>
          <div className="max-w-xl">
            <h2 className="text-3xl font-normal text-gray-900 mb-6" style={{ fontFamily: "'DM Serif Display', serif" }}>About this project</h2>
            <div className="space-y-4 text-gray-500 text-sm leading-relaxed">
              <p>
                This is a project exploring how AI can make complex financial data more accessible.<br />
                The idea started from a simple question:
              </p>
              <p className="text-gray-600 font-semibold pl-4">
                "What if you can just see how the numbers came to be?"
              </p>
              <p>
                The vision was to make AI that not only answers<br />
                but also <em className="text-gray-700">acts</em> on the UI, highlighting nodes and surfacing insights in context.
              </p>
              <p>
                Built by{' '}
                <a href="https://github.com/justinjedidiah" className="text-indigo-500 hover:text-indigo-700 underline underline-offset-2 transition-colors">
                  Justin Jedidiah Sunarko
                </a>.
              </p>
            </div>
            <div className="flex gap-3 mt-8">
              <a href="https://github.com/justinjedidiah" className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-900 transition-colors text-sm">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
                </svg>
                GitHub Project
              </a>
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors text-sm font-medium"
              >
                Open the app →
              </button>
            </div>
          </div>
        </Section>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-gray-100 bg-white mt-10">
        <div className="max-w-5xl mx-auto px-6 py-8 flex items-center justify-between text-xs text-gray-400">
          <span>clari<span className="text-indigo-400">tree</span> · portfolio project</span>
          <span>Built with React + FastAPI + LangGraph</span>
        </div>
      </footer>
    </div>
  );
}
