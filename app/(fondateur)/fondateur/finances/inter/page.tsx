// Same page logic as the admin version, but rendered inside the fondateur layout
// (SidebarFondateur) because this file lives in the (fondateur) route group.
// InterFilters uses usePathname() so its filter links stay on this path.
export { default, metadata } from "@/app/(admin)/finances/inter/page";
