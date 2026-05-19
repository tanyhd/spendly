export default function AnnualOverview({ stroke, ...rest }: { stroke?: string; [rest: string]: any }) {
    return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...rest}>
            <rect x="1.667" y="3.333" width="16.667" height="15" rx="1.5" stroke={stroke || 'currentColor'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M13.333 1.667V5" stroke={stroke || 'currentColor'} strokeWidth="1.75" strokeLinecap="round" />
            <path d="M6.667 1.667V5" stroke={stroke || 'currentColor'} strokeWidth="1.75" strokeLinecap="round" />
            <path d="M1.667 8.333H18.333" stroke={stroke || 'currentColor'} strokeWidth="1.75" strokeLinecap="round" />
            <circle cx="5.833" cy="12.083" r="1" fill={stroke || 'currentColor'} />
            <circle cx="10" cy="12.083" r="1" fill={stroke || 'currentColor'} />
            <circle cx="14.167" cy="12.083" r="1" fill={stroke || 'currentColor'} />
            <circle cx="5.833" cy="15.833" r="1" fill={stroke || 'currentColor'} />
            <circle cx="10" cy="15.833" r="1" fill={stroke || 'currentColor'} />
            <circle cx="14.167" cy="15.833" r="1" fill={stroke || 'currentColor'} />
        </svg>
    );
}
