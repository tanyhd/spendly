import Sidebar from '@/common/components/Sidebar';
import Topbar from '@/common/components/Topbar';
import { AuthProvider } from '@/context/AuthContext';
import styles from './AppLayout.module.css';

export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <div className={styles.shell}>
                <Sidebar />
                <div className={styles.content}>
                    <Topbar />
                    <main className={styles.main}>{children}</main>
                </div>
            </div>
        </AuthProvider>
    );
}
