# Desktop AI job search 0.1.11

Mac and Windows now expose the same AI job search page as the web app. Search uses the production knowledge API with the signed-in user's token; provider credentials remain on the server.

Results support full-database counts, ten results per page, direct page-number navigation, original announcement/application URLs, and independent follows of extracted positions. Followed positions appear in the existing follow-management screen. Announcement and application links use the desktop's existing embedded browser workflow.

Requires the deployed /api/knowledge/{status,chat,search,follows} endpoints and the position-follow schema. The existing production deployment already includes these endpoints. This desktop release does not modify server configuration.

Builds use the GitHub Actions Build Desktop App workflow: universal macOS DMG (Intel and Apple Silicon) and x64 Windows NSIS installer. Product version: 0.1.11.
