interface LogoProps {
  className?: string;
  showText?: boolean;
}

export default function Logo({ className = 'h-10 w-auto', showText = true }: LogoProps) {
  // We use standard SVG viewBox. If showText is true, the viewBox spans the symbol + text.
  // If showText is false, the viewBox is cropped to only show the symbol.
  const viewBox = showText ? '0 0 440 100' : '0 0 120 100';

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      className={`${className} select-none`}
      fill="none"
    >
      <defs>
        {/* Circuit line gradient definition */}
        <linearGradient id="circuit-grad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" className="text-blue-600 dark:text-cyan-400" style={{ stopColor: 'currentColor' }} />
          <stop offset="100%" className="text-purple-600 dark:text-purple-500" style={{ stopColor: 'currentColor' }} />
        </linearGradient>

        {/* Swoosh/Orbit ring gradient definition */}
        <linearGradient id="swoosh-grad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" className="text-purple-600 dark:text-cyan-400" style={{ stopColor: 'currentColor' }} />
          <stop offset="100%" className="text-blue-600 dark:text-purple-500" style={{ stopColor: 'currentColor' }} />
        </linearGradient>

        {/* Subtitle thin line gradients */}
        <linearGradient id="line-left-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" className="text-blue-600/10 dark:text-cyan-500/10" style={{ stopColor: 'currentColor' }} />
          <stop offset="100%" className="text-blue-600 dark:text-cyan-500" style={{ stopColor: 'currentColor' }} />
        </linearGradient>
        
        <linearGradient id="line-right-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" className="text-purple-600 dark:text-purple-500" style={{ stopColor: 'currentColor' }} />
          <stop offset="100%" className="text-purple-600/10 dark:text-purple-500/10" style={{ stopColor: 'currentColor' }} />
        </linearGradient>

        {/* Text gradient definition */}
        <linearGradient id="text-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" className="text-blue-600 dark:text-cyan-400" style={{ stopColor: 'currentColor' }} />
          <stop offset="100%" className="text-purple-600 dark:text-purple-500" style={{ stopColor: 'currentColor' }} />
        </linearGradient>

        {/* Mask to cut a clean gap in the right leg of the A symbol */}
        <mask id="right-leg-mask">
          {/* Default visible area */}
          <rect x="0" y="0" width="120" height="100" fill="#FFFFFF" />
          {/* Slanted mask cutting path aligned with the circuit lines */}
          <polygon points="35,62 70,21 80,30 45,71" fill="#000000" />
        </mask>
      </defs>

      {/* SYMBOL GROUP (X: 0 - 120, Y: 0 - 100) */}
      <g>
        {/* Layer 1: Left Leg of the 'A' */}
        <path
          d="M 50,15 L 18,85 L 30,85 L 50,48 Z"
          className="text-gray-900 dark:text-white transition-colors duration-300"
          fill="currentColor"
        />

        {/* Layer 2: Swoosh / Orbital Ring */}
        <path
          d="M 10,72 C 10,85 30,90 55,87 C 80,84 105,74 108,62 C 110,54 95,50 75,56 C 55,62 15,68 10,72 Z"
          fill="url(#swoosh-grad)"
        />

        {/* Layer 3: Right Leg of the 'A' (Masked to create gap) */}
        <path
          d="M 50,15 L 75,85 L 62,85 L 45,48 Z"
          className="text-gray-900 dark:text-white transition-colors duration-300"
          fill="currentColor"
          mask="url(#right-leg-mask)"
        />

        {/* Layer 4: Circuit lines running up-right and bending */}
        {/* Line 1 (Top) */}
        <path
          d="M 32,60 L 56,32 L 72,32 L 84,18"
          stroke="url(#circuit-grad)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Line 2 (Middle) */}
        <path
          d="M 28,66 L 52,38 L 68,38 L 80,24"
          stroke="url(#circuit-grad)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Line 3 (Bottom) */}
        <path
          d="M 24,72 L 48,44 L 64,44 L 76,30"
          stroke="url(#circuit-grad)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Circular terminal nodes for circuit lines */}
        {/* Top Node */}
        <circle
          cx="84"
          cy="18"
          r="4.5"
          className="text-purple-600 dark:text-purple-400"
          fill="currentColor"
        />
        {/* Middle Node */}
        <circle
          cx="80"
          cy="24"
          r="4.5"
          className="text-purple-600 dark:text-purple-400"
          fill="currentColor"
        />
        {/* Bottom Node */}
        <circle
          cx="76"
          cy="30"
          r="4.5"
          className="text-purple-600 dark:text-purple-400"
          fill="currentColor"
        />
      </g>

      {/* TEXT GROUP (Only rendered if showText is true) */}
      {showText && (
        <g>
          {/* Main Title: AIBugTriage */}
          <text
            x="130"
            y="55"
            className="text-gray-900 dark:text-white font-bold select-none transition-colors duration-300"
            style={{
              fontFamily: "'Outfit', 'Inter', -apple-system, sans-serif",
              fontSize: '36px',
              fontWeight: 800,
              letterSpacing: '2px',
            }}
          >
            {/* "AI" in gradient */}
            <tspan fill="url(#text-grad)">AI</tspan>
            {/* "BugTriage" in theme text color */}
            <tspan fill="currentColor">BugTriage</tspan>
          </text>

          {/* Subtitle Left Line */}
          <line
            x1="130"
            y1="76"
            x2="190"
            y2="76"
            stroke="url(#line-left-grad)"
            strokeWidth="1.5"
          />

          {/* Subtitle Text: AI-POWERED TRIAGE */}
          <text
            x="280"
            y="80"
            textAnchor="middle"
            className="text-gray-600 dark:text-gray-400 select-none transition-colors duration-300"
            style={{
              fontFamily: "'Outfit', 'Inter', -apple-system, sans-serif",
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '4px',
            }}
            fill="currentColor"
          >
            AI-POWERED TRIAGE
          </text>

          {/* Subtitle Right Line */}
          <line
            x1="370"
            y1="76"
            x2="430"
            y2="76"
            stroke="url(#line-right-grad)"
            strokeWidth="1.5"
          />
        </g>
      )}
    </svg>
  );
}
