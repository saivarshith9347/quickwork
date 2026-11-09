/**
 * Avatar utilities - compute initials from names
 * Never store initials in the database; compute them in the UI
 */

/**
 * Generate initials from a name
 * @param name - User's full name
 * @returns Two-letter initials (e.g., "John Doe" -> "JD")
 */
export function getInitials(name: string | null | undefined): string {
  if (!name || name.trim() === "") {
    return "U"; // Default fallback
  }

  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Get avatar display value - either the URL or computed initials
 * @param avatarUrl - Avatar URL (if available)
 * @param name - User's name for generating initials
 * @returns Avatar URL or initials
 */
export function getAvatarDisplay(
  avatarUrl: string | null | undefined,
  name: string | null | undefined,
): string {
  if (avatarUrl && avatarUrl.trim() !== "") {
    return avatarUrl;
  }
  return getInitials(name);
}
