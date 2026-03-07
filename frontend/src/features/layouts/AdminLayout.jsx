import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BookCheck,
  ChevronsUpDown,
  ChevronRight,
  ClipboardList,
  FileText,
  GraduationCap,
  Headphones,
  LayoutDashboard,
  ListChecks,
  Layers,
  Mic,
  Pen,
  Settings2,
  Sparkles,
  Users,
} from 'lucide-react';
import {
  UI_ROLE_STUDENT_ACA,
  UI_ROLE_STUDENT_IELTS,
  getDefaultRouteForRole,
  normalizeUserRole,
  USER_ROLE_ADMIN,
} from '@/app/roleRouting';
import { api } from '@/shared/api/client';
import { sanitizeActiveUIRoleForUser, setActiveUIRole } from '@/app/activeUIRole';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NavUser } from '@/components/nav-user';
import { createAvatarUrl, fallbackAvatarSeed, sanitizeAvatarSeed } from '@/features/profile/profile.helpers';
import './AdminSidebarLayout.css';

const ADMIN_MANAGE_SUB_ITEMS = [
  { key: 'manage-passages', label: 'Manage Passages', to: '/admin/manage/passages' },
  { key: 'manage-sections', label: 'Manage Listening', to: '/admin/manage/sections' },
  { key: 'manage-writings', label: 'Manage Writing Tasks', to: '/admin/manage/writings' },
  { key: 'manage-speaking', label: 'Manage Speaking Topics', to: '/admin/manage/speaking' },
  { key: 'manage-tests', label: 'Manage Full Tests', to: '/admin/manage/tests' },
  { key: 'manage-skill-modules', label: 'Manage Skill Modules', to: '/admin/manage/skill-modules' },
];

const ADMIN_PEOPLE_SUB_ITEMS = [
  { key: 'people-request', label: 'Approve Students', to: '/admin/people/request' },
  { key: 'people-users', label: 'Manage Users', to: '/admin/people/users' },
  { key: 'people-invitation', label: 'Send Invitations', to: '/admin/people/invitation' },
];

const OVERVIEW_NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard, exact: true },
  { key: 'homework-progress', label: 'Homework Progress', to: '/dashboard/homework-progress', icon: ListChecks },
  { key: 'homeroom-students', label: 'Homeroom Students', to: '/dashboard/homeroom-students', icon: Users },
];

const TEACHER_NAV_ITEMS = [
  { key: 'grading', label: 'Grading', to: '/grading', icon: BookCheck },
  { key: 'scores', label: 'Scores', to: '/scores', icon: ClipboardList },
  { key: 'evaluate', label: 'Evaluate', to: '/evaluate', icon: Sparkles },
  { key: 'homework', label: 'Homework', to: '/homework', icon: FileText },
];

const ADMIN_SWITCHER_DEFAULT_VALUE = '__admin_default__';

const ADMIN_UI_ROLE_OPTIONS = [
  { value: ADMIN_SWITCHER_DEFAULT_VALUE, label: 'Admin' },
  { value: UI_ROLE_STUDENT_IELTS, label: 'Student IELTS UI' },
  { value: UI_ROLE_STUDENT_ACA, label: 'Student ACA UI' },
];

const TEACHER_UI_ROLE_OPTIONS = [
  { value: UI_ROLE_STUDENT_IELTS, label: 'Student IELTS UI' },
  { value: UI_ROLE_STUDENT_ACA, label: 'Student ACA UI' },
];

const isTabMatch = (pathname, to) => pathname === to || pathname.startsWith(`${to}/`);
const isAdminPeoplePath = (pathname) => ADMIN_PEOPLE_SUB_ITEMS.some((item) => isTabMatch(pathname, item.to));
const toSafeText = (value) => String(value || '').trim();
const resolveSidebarAvatar = (user) => {
  const avatarSeed = toSafeText(user?.avatarSeed);
  if (avatarSeed) {
    return createAvatarUrl(sanitizeAvatarSeed(avatarSeed, fallbackAvatarSeed(user || {})));
  }

  const directAvatar = toSafeText(user?.avatar || user?.avatarUrl || user?.photoURL);
  if (directAvatar) return directAvatar;

  const seed = toSafeText(user?.avatarSeed || user?.email || user?.name || user?._id || user?.id || 'workspace-user');
  const params = new URLSearchParams({
    seed,
    backgroundColor: 'b6e3f4,c0aede,d1d4f9,ffd5dc',
  });
  return `https://api.dicebear.com/9.x/micah/svg?${params.toString()}`;
};

const BREADCRUMB_LABELS = {
  dashboard: 'Dashboard',
  grading: 'Grading',
  scores: 'Scores',
  evaluate: 'Evaluate',
  homework: 'Homework',
  groups: 'Groups',
  assignments: 'Assignments',
  submissions: 'Submissions',
  analytics: 'Analytics',
  settings: 'Settings',
  'homework-progress': 'Homework Progress',
  'homeroom-students': 'Homeroom Students',
  student: 'Student',
  manage: 'Manage',
  passages: 'Passages',
  sections: 'Listening',
  writings: 'Writing Tasks',
  speaking: 'Speaking Topics',
  tests: 'Full Tests',
  'skill-modules': 'Skill Modules',
  requests: 'Approve Students',
  request: 'Approve Students',
  users: 'Users',
  people: 'People',
  invitations: 'Invitations',
  invitation: 'Invitations',
  new: 'New',
};

const toTitle = (raw) => raw
  .split('-')
  .filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

const toBreadcrumbLabel = (segment, overrides = {}) => {
  if (!segment) return '';
  if (overrides[segment]) return overrides[segment];
  if (BREADCRUMB_LABELS[segment]) return BREADCRUMB_LABELS[segment];
  if (/^[a-f0-9]{8,}$/i.test(segment) || /^\d+$/.test(segment)) return 'Detail';
  return toTitle(segment);
};

const buildBreadcrumbItems = (pathname, overrides = {}) => {
  const rawSegments = pathname.split('/').filter(Boolean);
  const segments = rawSegments.filter(segment => segment !== 'lessons');
  if (!segments.length) return [];

  if (segments[0] === 'admin' && segments[1] === 'manage') {
    const crumbs = [
      {
        label: 'Manage',
        to: segments.length > 2 ? '/admin/manage' : undefined,
      },
    ];

    if (segments[2]) {
      crumbs.push({
        label: toBreadcrumbLabel(segments[2]),
        to: segments.length > 3 ? `/admin/manage/${segments[2]}` : undefined,
      });
    }

    if (segments[3]) {
      crumbs.push({ label: toBreadcrumbLabel(segments[3]) });
    }

    if (segments[4]) {
      crumbs.push({ label: toBreadcrumbLabel(segments[4]) });
    }

    return crumbs;
  }

  if (segments[0] === 'admin' && segments[1] === 'people') {
    const crumbs = [
      {
        label: 'People',
        to: segments.length > 2 ? '/admin/people' : undefined,
      },
    ];

    if (segments[2]) {
      crumbs.push({
        label: toBreadcrumbLabel(segments[2]),
        to: segments.length > 3 ? `/admin/people/${segments[2]}` : undefined,
      });
    }

    if (segments[3]) {
      crumbs.push({ label: toBreadcrumbLabel(segments[3]) });
    }

    return crumbs;
  }

  const first = segments[0];
  const crumbs = [
    {
      label: toBreadcrumbLabel(first, overrides),
      to: segments.length > 1 ? `/${first}` : undefined,
    },
  ];

  if (segments[1]) {
    crumbs.push({
      label: toBreadcrumbLabel(segments[1], overrides),
      to: segments.length > 2 ? `/${first}/${segments[1]}` : undefined,
    });
  }

  if (segments[2]) {
    crumbs.push({
      label: toBreadcrumbLabel(segments[2], overrides),
      to: segments.length > 3 ? `/${first}/${segments[1]}/${segments[2]}` : undefined,
    });
  }

  if (segments[3]) {
    crumbs.push({
      label: toBreadcrumbLabel(segments[3], overrides),
      to: segments.length > 4 ? `/${first}/${segments[1]}/${segments[2]}/${segments[3]}` : undefined,
    });
  }

  if (segments[4]) {
    crumbs.push({ label: toBreadcrumbLabel(segments[4], overrides) });
  }

  return crumbs;
};

export default function AdminLayout() {
  const navigate = useNavigate();
  const pathname = useLocation().pathname;
  const [sessionUser, setSessionUser] = useState(() => api.getUser());
  const [isManageMenuOpen, setIsManageMenuOpen] = useState(
    pathname.startsWith('/admin/manage') && !isAdminPeoplePath(pathname),
  );
  const [isPeopleMenuOpen, setIsPeopleMenuOpen] = useState(pathname.startsWith('/admin/people'));
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const user = sessionUser;
  const isAdminUser = normalizeUserRole(user?.role) === USER_ROLE_ADMIN;
  const uiRoleOptions = isAdminUser ? ADMIN_UI_ROLE_OPTIONS : TEACHER_UI_ROLE_OPTIONS;
  const workspaceLabel = isAdminUser ? 'Admin Workspace' : 'Teacher Workspace';
  const workspaceHome = '/dashboard';
  const navUser = useMemo(() => {
    const email = String(user?.email || '').trim() || 'no-email@local';
    const displayName = String(user?.name || user?.fullName || user?.username || '').trim() || 'Workspace User';
    return {
      name: displayName,
      email,
      avatar: resolveSidebarAvatar(user),
    };
  }, [user]);

  const selectedRole = useMemo(
    () => sanitizeActiveUIRoleForUser(user, ''),
    [user],
  );
  const [breadcrumbOverrides, setBreadcrumbOverrides] = useState({});

  useEffect(() => {
    const handleOverride = (event) => {
      const { segment, label } = event?.detail || {};
      if (!segment) return;
      setBreadcrumbOverrides((prev) => {
        if (prev[segment] === label) return prev;
        return { ...prev, [segment]: label || null };
      });
    };
    window.addEventListener('breadcrumb-label-override', handleOverride);
    return () => window.removeEventListener('breadcrumb-label-override', handleOverride);
  }, []);

  useEffect(() => {
    setBreadcrumbOverrides({});
  }, [pathname]);

  const breadcrumbItems = useMemo(
    () => buildBreadcrumbItems(pathname, breadcrumbOverrides),
    [pathname, breadcrumbOverrides],
  );
  const switcherRole = useMemo(() => {
    if (isAdminUser) return ADMIN_SWITCHER_DEFAULT_VALUE;
    if (uiRoleOptions.some((option) => option.value === selectedRole)) {
      return selectedRole;
    }
    return uiRoleOptions[0]?.value || UI_ROLE_STUDENT_IELTS;
  }, [isAdminUser, selectedRole, uiRoleOptions]);

  useEffect(() => {
    const syncUser = (event) => {
      const nextUser = event?.detail ?? api.getUser();
      setSessionUser(nextUser || null);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('auth-user-updated', syncUser);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('auth-user-updated', syncUser);
      }
    };
  }, []);

  useEffect(() => {
    if (isAdminUser) {
      setActiveUIRole(USER_ROLE_ADMIN);
      return;
    }
    setActiveUIRole(switcherRole);
  }, [switcherRole]);

  useEffect(() => {
    if (pathname.startsWith('/admin/people')) {
      setIsPeopleMenuOpen(true);
    } else if (pathname.startsWith('/admin/manage')) {
      setIsManageMenuOpen(true);
    }
  }, [pathname]);

  const switcherLabel = useMemo(
    () => uiRoleOptions.find((option) => option.value === switcherRole)?.label || 'UI Role',
    [switcherRole, uiRoleOptions],
  );

  const handleSwitchRole = (nextRoleValue) => {
    const nextRole = String(nextRoleValue || '').trim();
    if (isAdminUser && nextRole === ADMIN_SWITCHER_DEFAULT_VALUE) {
      setActiveUIRole(USER_ROLE_ADMIN);
      return;
    }
    const safeRole = sanitizeActiveUIRoleForUser(user, nextRole);
    setActiveUIRole(safeRole);
    const targetPath = getDefaultRouteForRole(safeRole);
    if (typeof window !== 'undefined') {
      window.open(targetPath, '_blank', 'noopener,noreferrer');
      return;
    }
    navigate(targetPath);
  };
  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await api.logout();
    } finally {
      navigate('/login', { replace: true });
      setIsLoggingOut(false);
    }
  };

  return (
    <SidebarProvider>
      <Sidebar className="admin-sidebar-shell" collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link to={workspaceHome} className="admin-sidebar-shell__brand">
                  <div className="admin-sidebar-shell__brand-icon">
                    <GraduationCap size={16} />
                  </div>
                  <div className="admin-sidebar-shell__brand-meta">
                    <span className="admin-sidebar-shell__brand-title">{workspaceLabel}</span>
                    <span className="admin-sidebar-shell__brand-subtitle">
                      {isAdminUser ? 'Administrator' : 'Teacher'}
                    </span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarSeparator />

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Overview</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {OVERVIEW_NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const active = item.exact ? pathname === item.to : isTabMatch(pathname, item.to);
                  return (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                        <NavLink to={item.to}>
                          <Icon />
                          <span>{item.label}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {isAdminUser ? (
            <SidebarGroup>
              <SidebarGroupLabel>Admin</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <Collapsible
                    asChild
                    open={isManageMenuOpen}
                    onOpenChange={setIsManageMenuOpen}
                    className="group/collapsible"
                  >
                    <SidebarMenuItem key="manage">
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          isActive={pathname.startsWith('/admin/manage')}
                          tooltip="Manage"
                        >
                          <Settings2 />
                          <span>Manage</span>
                          <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {ADMIN_MANAGE_SUB_ITEMS.map((item) => {
                            const active = isTabMatch(pathname, item.to);
                            return (
                              <SidebarMenuSubItem key={item.key}>
                                <SidebarMenuSubButton asChild isActive={active}>
                                  <NavLink to={item.to}>
                                    <span>{item.label}</span>
                                  </NavLink>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            );
                          })}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>

                  <Collapsible
                    asChild
                    open={isPeopleMenuOpen}
                    onOpenChange={setIsPeopleMenuOpen}
                    className="group/collapsible"
                  >
                    <SidebarMenuItem key="people">
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          isActive={isAdminPeoplePath(pathname)}
                          tooltip="People"
                        >
                          <Users />
                          <span>People</span>
                          <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {ADMIN_PEOPLE_SUB_ITEMS.map((item) => {
                            const active = isTabMatch(pathname, item.to);
                            return (
                              <SidebarMenuSubItem key={item.key}>
                                <SidebarMenuSubButton asChild isActive={active}>
                                  <NavLink to={item.to}>
                                    <span>{item.label}</span>
                                  </NavLink>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            );
                          })}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ) : null}

          <SidebarGroup>
            <SidebarGroupLabel>Teaching</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {TEACHER_NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const active = isTabMatch(pathname, item.to);
                  return (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                        <NavLink to={item.to}>
                          <Icon />
                          <span>{item.label}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <div className="admin-sidebar-shell__switcher-wrap">
            <label>UI Role</label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="admin-sidebar-shell__switcher-trigger">
                  <span>{switcherLabel}</span>
                  <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-70" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="end"
                className="admin-sidebar-shell__switcher-menu"
              >
                <DropdownMenuRadioGroup value={switcherRole} onValueChange={handleSwitchRole}>
                  {uiRoleOptions.map((option) => (
                    <DropdownMenuRadioItem
                      key={option.value}
                      value={option.value}
                      className="admin-sidebar-shell__switcher-item"
                    >
                      {option.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="admin-sidebar-shell__nav-user">
            <NavUser user={navUser} onLogout={handleLogout} isLoggingOut={isLoggingOut} />
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="admin-sidebar-shell__inset">
        <header className="admin-sidebar-shell__header">
          <div className="admin-sidebar-shell__header-inner">
            <SidebarTrigger className="admin-sidebar-shell__trigger" />
            <Separator
              orientation="vertical"
              className="admin-sidebar-shell__header-separator"
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:inline-flex">
                  <BreadcrumbLink asChild>
                    <Link to={workspaceHome}>{workspaceLabel}</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                {breadcrumbItems.map((item, index) => {
                  const isLast = index === breadcrumbItems.length - 1;
                  return (
                    <Fragment key={`${item.label}-${index}`}>
                      <BreadcrumbSeparator className={index === 0 ? 'hidden md:inline-flex' : ''} />
                      <BreadcrumbItem>
                        {!isLast && item.to ? (
                          <BreadcrumbLink asChild>
                            <Link to={item.to}>{item.label}</Link>
                          </BreadcrumbLink>
                        ) : (
                          <BreadcrumbPage>{item.label}</BreadcrumbPage>
                        )}
                      </BreadcrumbItem>
                    </Fragment>
                  );
                })}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="admin-sidebar-shell__content">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
