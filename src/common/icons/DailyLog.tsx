export default function DailyLog({ stroke, ...rest }: { stroke?: string; [rest: string]: any }) {
    return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...rest}>
            <rect x="2.5" y="1.667" width="15" height="16.667" rx="1.5" stroke={stroke || 'currentColor'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="6.25" cy="7.5" r="1" fill={stroke || 'currentColor'} />
            <path d="M9.167 7.5H15" stroke={stroke || 'currentColor'} strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="6.25" cy="11.25" r="1" fill={stroke || 'currentColor'} />
            <path d="M9.167 11.25H15" stroke={stroke || 'currentColor'} strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="6.25" cy="15" r="1" fill={stroke || 'currentColor'} />
            <path d="M9.167 15H13.333" stroke={stroke || 'currentColor'} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}
