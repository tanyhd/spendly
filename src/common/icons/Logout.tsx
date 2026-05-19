export default function Logout({ stroke, ...rest }: { stroke?: string; [rest: string]: any }) {
    return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...rest}>
            <path d="M7.5 17.5H4.167A1.667 1.667 0 012.5 15.833V4.167A1.667 1.667 0 014.167 2.5H7.5" stroke={stroke || 'currentColor'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M13.333 14.167L17.5 10L13.333 5.833" stroke={stroke || 'currentColor'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M17.5 10H7.5" stroke={stroke || 'currentColor'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}
