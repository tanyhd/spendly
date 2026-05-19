export default function Bank({ stroke, ...rest }: { stroke?: string; [rest: string]: any }) {
    return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...rest}>
            <path d="M10 1.667L1.667 6.667H18.333L10 1.667Z" stroke={stroke || 'currentColor'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M1.667 16.667H18.333" stroke={stroke || 'currentColor'} strokeWidth="1.5" strokeLinecap="round" />
            <path d="M1.667 18.333H18.333" stroke={stroke || 'currentColor'} strokeWidth="1.5" strokeLinecap="round" />
            <path d="M4.167 6.667V16.667" stroke={stroke || 'currentColor'} strokeWidth="1.5" strokeLinecap="round" />
            <path d="M7.917 6.667V16.667" stroke={stroke || 'currentColor'} strokeWidth="1.5" strokeLinecap="round" />
            <path d="M12.083 6.667V16.667" stroke={stroke || 'currentColor'} strokeWidth="1.5" strokeLinecap="round" />
            <path d="M15.833 6.667V16.667" stroke={stroke || 'currentColor'} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}
