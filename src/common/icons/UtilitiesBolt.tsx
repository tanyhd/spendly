export default function UtilitiesBolt({ stroke, ...rest }: { stroke?: string; [key: string]: any }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" {...rest}>
            <path d="M7 2v11h3v9l7-12h-4l4-8z" />
        </svg>
    );
}
