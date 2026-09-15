// discordAvatarHash is null when the user has never set a custom Discord avatar - Discord does
// have default per-user avatar URLs for that case, but this app just falls back to initials
// (AvatarFallback) instead of reproducing Discord's default-avatar selection logic.
export function discordAvatarUrl(user: { discordId: string; discordAvatarHash: string | null }) {
  if (!user.discordAvatarHash) return undefined;
  return `https://cdn.discordapp.com/avatars/${user.discordId}/${user.discordAvatarHash}.png`;
}
