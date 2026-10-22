import AppShell from '@/common/components/AppShell';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';
import { ExpenseProvider } from '@/context/ExpenseContext';

export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <ToastProvider>
                <ExpenseProvider>
                    <AppShell>{children}</AppShell>
                </ExpenseProvider>
            </ToastProvider>
        </AuthProvider>
    );
}
