import AppShell from '@/common/components/AppShell';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';
import { ExpenseProvider } from '@/context/ExpenseContext';
import { NavigationGuardProvider } from '@/context/NavigationGuardContext';

export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <ToastProvider>
                <ExpenseProvider>
                    <NavigationGuardProvider>
                        <AppShell>{children}</AppShell>
                    </NavigationGuardProvider>
                </ExpenseProvider>
            </ToastProvider>
        </AuthProvider>
    );
}
