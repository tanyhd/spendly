export default function Settings({ stroke, ...rest }: { stroke?: string; [rest: string]: any }) {
    return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...rest}>
            <circle cx="10" cy="10" r="2.917" stroke={stroke || 'currentColor'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M16.167 10a6.25 6.25 0 01-.075 0.958l2.075 1.617-1.667 2.883-2.4-.958a6.25 6.25 0 01-1.658.958L12.083 17.5H7.917l-.358-2.042a6.25 6.25 0 01-1.659-.958l-2.4.958L1.833 12.575l2.075-1.617A6.25 6.25 0 013.833 10a6.25 6.25 0 01.075-.958L1.833 7.425 3.5 4.542l2.4.958A6.25 6.25 0 017.558 4.542L7.917 2.5h4.166l.359 2.042a6.25 6.25 0 011.658.958l2.4-.958 1.667 2.883-2.075 1.617A6.25 6.25 0 0116.167 10z" stroke={stroke || 'currentColor'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}
