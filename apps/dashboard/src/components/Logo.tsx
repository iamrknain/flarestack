/**
 * FlareStack Brand Logo Component
 *
 * Uses Vite asset imports so the correct hashed URL is resolved at build time.
 *
 * Props:
 *   variant:  "icon" | "full"               (default: "full")
 *   bg:       "none" | "white" | "dark"     (default: "none", only applies for full variant)
 *   size:     height in px                  (default: 36)
 *   animate:  boolean                       (default: true)
 */

const iconSrc = "/assets/icon.png";
const logoBglessSrc = "/assets/logo-bgless.png";
const logoWhiteSrc = "/assets/logo-white.png";
const logoDarkSrc = "/assets/logo-dark.png";

interface LogoProps {
    variant?: "icon" | "full";
    bg?: "none" | "white" | "dark";
    size?: number;
    animate?: boolean;
    className?: string;
}

// Inject keyframes once on the client
if (typeof document !== "undefined") {
    const id = "ff-logo-styles";
    if (!document.getElementById(id)) {
        const s = document.createElement("style");
        s.id = id;
        s.textContent = `
            @keyframes ff-glow {
                0%,100% { filter: drop-shadow(0 0 0px transparent); }
                50%      { filter: drop-shadow(0 2px 10px rgba(99,102,241,0.4)); }
            }
        `;
        document.head.appendChild(s);
    }
}

export function Logo({
    variant = "full",
    bg = "none",
    size = 36,
    animate = true,
    className = "",
}: LogoProps) {
    const src = variant === "icon"
        ? iconSrc
        : bg === "dark" ? logoDarkSrc
            : bg === "white" ? logoWhiteSrc
                : logoBglessSrc;

    const alt = variant === "icon" ? "FlareStack" : "FlareStack";

    return (
        <img
            src={src}
            alt={alt}
            height={size}
            style={{
                height: size,
                width: "auto",
                display: "block",
                animation: animate ? "ff-glow 3s ease-in-out infinite" : undefined,
            }}
            className={className}
            draggable={false}
        />
    );
}
