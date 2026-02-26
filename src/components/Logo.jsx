/**
 * Productify brand logo — layered squares forming a "P" shape
 * with the primary green accent.
 */
export default function Logo({ size = 32 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Background rounded square */}
            <rect width="32" height="32" rx="8" fill="#16a34a" />

            {/* Letter P — built from geometric shapes */}
            <path
                d="M10 7h8a6 6 0 0 1 6 6v0a6 6 0 0 1-6 6h-4v6h-4V7z"
                fill="white"
                opacity="0.95"
            />
            {/* Inner cutout for P bowl */}
            <rect x="14" y="11" width="4" height="4" rx="2" fill="#16a34a" />

            {/* Accent bar */}
            <rect x="10" y="25" width="12" height="2" rx="1" fill="white" opacity="0.5" />
        </svg>
    );
}
