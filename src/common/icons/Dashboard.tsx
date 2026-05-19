export default function Dashboard({ stroke, ...rest }: { stroke?: string; [rest: string]: any }) {
    return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...rest}>
            <rect x="1.667" y="1.667" width="7.5" height="16.667" rx="1.25" stroke={stroke || 'currentColor'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="10.833" y="1.667" width="7.5" height="7.5" rx="1.25" stroke={stroke || 'currentColor'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="10.833" y="10.833" width="7.5" height="7.5" rx="1.25" stroke={stroke || 'currentColor'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}
