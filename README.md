# Close Stale Issues and PRs

Warns and then closes issues that have had no activity for a  specified amount of time.

## Dry Run

To ensure you don't spam your users and close or label incorrect issues this action defaults to running without actually performing any action, we call this a dry run.

To allow the action to actually perform any action set `dry-run` to true.

### Usage

See [action.yml](./action.yml) For comprehensive list of options.
 
Basic:

```yaml
name: "Close stale issues"
on:
  schedule:
  - cron: "0 0 * * *"

jobs:
  stale:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/stale@v1
      with:
        repo-token: ${{ secrets.GITHUB_TOKEN }}
        stale-message: 'Message to comment on stale issues. If none provided, will not mark issues stale'
        dry-run: true
```
 
Configure stale timeouts:

```yaml
name: "Close stale issues"
on:
  schedule:
  - cron: "0 0 * * *"

jobs:
  stale:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/stale@v1
      with:
        repo-token: ${{ secrets.GITHUB_TOKEN }}
        stale-message: 'This issue is stale because it has been open 30 days with no activity. Remove stale label or comment or this will be closed in 5 days'
        days-before-stale: 30
        days-before-close: 5
```
 
Configure labels:

```yaml
name: "Close stale issues"
on:
  schedule:
  - cron: "0 0 * * *"

jobs:
  stale:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/stale@v1
      with:
        repo-token: ${{ secrets.GITHUB_TOKEN }}
        stale-message: 'Stale issue message'
        stale-label: 'no-issue-activity'
        exempt-labels: 'awaiting-approval, security'
```
