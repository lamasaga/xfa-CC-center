import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, type User } from '@/services/api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** 当前用户角色是否为其中之一 */
  hasPermission: (...roles: string[]) => boolean;
  /** 教务 / 指导老师 / 管理员：可维护成绩、任务、选课、学生申请院校等（学生只读） */
  canEditSchoolData: boolean;
  /** 与 canEditSchoolData 相同语义，命名更明确 */
  canEditStudentRecords: boolean;
  /** 管理员 / 指导老师：维护院校库主数据 */
  canEditUniversityCatalog: boolean;
  /** 管理员 / 教务 / 指导老师 / 教师：维护考季排期 */
  canEditExamSessions: boolean;
  /** 管理员 / 教务：新增、删除学生 */
  canManageStudentRoster: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 每次启动都向服务端确认会话；Cookie 为主，本地 token 仅兼容升级前会话。
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userData = await authApi.getMe();
        if (userData.role === 'student' && userData.student_id) {
          localStorage.setItem('lastViewedStudentId', userData.student_id);
        }
        if ((userData as User & { auth_mode?: string }).auth_mode === 'session') {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
        setUser(userData);
      } catch (error) {
        console.info('No active session:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const response = await authApi.login(username, password);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    if (response.user.role === 'student' && response.user.student_id) {
      localStorage.setItem('lastViewedStudentId', response.user.student_id);
    }
    setUser(response.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // 即使服务端会话已失效，也要完成本地退出。
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    window.location.href = '/login';
  }, []);

  const hasPermission = useCallback((...roles: string[]) => {
    if (!user) return false;
    return roles.includes(user.role);
  }, [user]);

  const canEditStudentRecords =
    !!user && (user.role === 'admin' || user.role === 'staff' || user.role === 'supervisor');
  const canEditUniversityCatalog = !!user && (user.role === 'admin' || user.role === 'supervisor');
  const canEditExamSessions =
    !!user &&
    (user.role === 'admin' ||
      user.role === 'staff' ||
      user.role === 'supervisor' ||
      user.role === 'teacher');
  const canManageStudentRoster = !!user && (user.role === 'admin' || user.role === 'staff');
  const canEditSchoolData = canEditStudentRecords;

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    hasPermission,
    canEditSchoolData,
    canEditStudentRecords,
    canEditUniversityCatalog,
    canEditExamSessions,
    canManageStudentRoster,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Provider 与配套 hook 保持同一文件，避免在本次会话升级中扩大跨文件改动。
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
