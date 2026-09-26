import { Icon } from "@/components/Icon";

/** Déconnexion : formulaire POST (un lien pourrait être déclenché par un prefetch). */
export function LogoutButton() {
  return (
    <form action="/api/auth/logout" method="post" className="contents">
      <button type="submit" className="ds-icon-btn" aria-label="Se déconnecter" title="Se déconnecter">
        <Icon name="LogOut" size={16} aria-hidden />
      </button>
    </form>
  );
}
