# Product identity migration

Product name: **Reply Sprout**. Intended repository name: `reply-sprout`.

The GitHub integration cannot rename repositories (HTTP 403). Until the owner saves the new name at https://github.com/anshuman-pandey/snippet-cabinet/settings, the current repository URL and source directory remain valid. Do not create a replacement repository: rename the existing one to preserve issues, stars and history.

Existing storage keys, database paths, Docker volume names and backup schemas remain unchanged. This avoids losing saved user data during a branding-only update. After renaming, update the Git remote and documentation URLs; GitHub normally redirects the old repository URL. Existing published releases retain their original names until explicitly updated.
