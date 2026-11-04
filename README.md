<h1 align="center">suveng-dsh-plugin-memory</h1>

<p align="center"><strong>English</strong> · <a href="https://github.com/suveng/suveng-dsh-plugin-memory/blob/main/README.zh-CN.md">简体中文</a></p>

<p align="center">
  <a href="https://www.npmjs.com/package/suveng-dsh-plugin-memory"><img alt="npm version" src="https://img.shields.io/npm/v/suveng-dsh-plugin-memory?label=npm" /></a>
  <a href="https://www.npmjs.com/package/suveng-dsh-plugin-memory"><img alt="npm downloads" src="https://img.shields.io/npm/dt/suveng-dsh-plugin-memory?label=downloads%20total" /></a>
  <a href="https://github.com/suveng/suveng-dsh-plugin-memory/releases/latest"><img alt="GitHub release" src="https://img.shields.io/github/v/release/suveng/suveng-dsh-plugin-memory" /></a>
  <a href="https://github.com/suveng/suveng-dsh-plugin-memory"><img alt="GitHub stars" src="https://img.shields.io/github/stars/suveng/suveng-dsh-plugin-memory" /></a>
  <a href="https://github.com/suveng/suveng-dsh-plugin-memory/blob/main/LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-yellow.svg" /></a>
  <a href="https://dshfind.com/en/plugins/suveng/suveng-dsh-plugin-memory?ref=badge"><img alt="dshfind" src="https://dshfind.com/api/badge/suveng/suveng-dsh-plugin-memory?lang=en" /></a>
  <a href="https://dshfind.com/en/plugins/suveng/suveng-dsh-plugin-memory?ref=badge"><img alt="dshfind downloads" src="https://dshfind.com/api/badge/suveng/suveng-dsh-plugin-memory?metric=downloads&amp;lang=en" /></a>
</p>

<p align="center"><strong>Composable, view-based context for DeepSeek Harness.</strong></p>
<p align="center">Pluggable sources and strategies, with layered memory and self-evolving skills out of the box.</p>

<p align="center">
  <a href="https://github.com/suveng/suveng-dsh-plugin-memory/blob/main/docs/en/guides/ui-guide.md#in-a-conversation">
    <img src="https://raw.githubusercontent.com/suveng/suveng-dsh-plugin-memory/main/docs/assets/webui-v0.5.32/en/recall.gif" alt="A question answered from working memory and Project Documents; the expanded turn memory bar opens the document it read in Project Documents" width="880" />
  </a>
</p>

<p align="center">
  <a href="https://github.com/suveng/suveng-dsh-plugin-memory/blob/main/docs/en/guides/installation.md"><strong>Install and start</strong></a> ·
  <a href="https://github.com/suveng/suveng-dsh-plugin-memory/blob/main/docs/assets/webui-v0.5.32/README.md">Watch the demo</a> ·
  <a href="https://github.com/suveng/suveng-dsh-plugin-memory/blob/main/docs/en/README.md">Documentation</a> ·
  <a href="https://github.com/suveng/suveng-dsh-plugin-memory/blob/main/docs/en/development/extensions.md">Build a plugin</a>
</p>

## Why suveng-dsh-plugin-memory

An Agent that starts every session from scratch keeps asking what it was already told. Putting everything into one memory store is no better: it either floods each turn or misses what matters. suveng-dsh-plugin-memory gives DeepSeek Harness memory that is layered, visible and composable, and skills that improve with use.

- **The right memory for each turn.** Preferences and working facts stay in context. Project documents and long-term evidence are searched only when a question needs them.
- **You can see what a turn used.** Under each reply, the turn memory bar lists the documents and memories the turn read and wrote, and one click opens each in the Memory System. The Memory System shows everything that is stored and lets you edit it.
- **Save to memory in one click.** When a conversation turns up a fact worth keeping, the brain mark under the reply hands it to a task Agent, which removes duplicates, distils it and writes it to the right Memory Space, or saves it where you choose: working memory, your profile or a Memory Space. The receipt says where it went.
- **Skills that improve with use.** Skills keeps every DSH skill in one place. It can review your real conversations, draft a better `SKILL.md` and backtest it before you adopt it, and it installs more skills from skills.sh, GitHub and sites that publish Agent Skills.
- **Compose it on the Plugins page.** Choose a main strategy and optional enhancements, and switch them without moving any data. Every component has its own page for its settings.
- **Keep data where you want it.** Local by default with Mnemon Native, or one of eight third-party Providers. Storage can be global, per workspace, centralized or in a directory you choose, with ZIP backup.
- **Extend it.** Sources and Strategies are ordinary DSH plugins built on public SDKs. An installed component gets the same pages and switches as the shipped ones.

## See it in action

These recordings come from a real WebUI with the live DeepSeek model answering, on a seeded, fictional project, Lumen. Waits for the model play faster, marked in the lower right corner.

**Save a new fact to memory.** A reply reports a new measurement. Select the brain mark under it, cut the candidate down to the sentence worth keeping and send it to the task Agent; the receipt names the Memory Space it went to and opens it in one click.

<p align="center">
  <a href="https://github.com/suveng/suveng-dsh-plugin-memory/blob/main/docs/en/guides/ui-guide.md#save-to-memory"><img src="https://raw.githubusercontent.com/suveng/suveng-dsh-plugin-memory/main/docs/assets/webui-v0.5.32/en/save.gif" alt="Save to memory: edit the candidate, look at where it can go and keep Let the Agent decide, send it to the task Agent, then view the new memory from the Saved receipt" width="880" /></a>
</p>

**See all memory in one place.** Status, runtime memory, Project Documents and Memory Spaces live in the Memory System. The graph links memories through the entities they mention, and Ask Agent answers with the memories it cites, by content.

<p align="center">
  <a href="https://github.com/suveng/suveng-dsh-plugin-memory/blob/main/docs/en/guides/ui-guide.md#the-memory-system"><img src="https://raw.githubusercontent.com/suveng/suveng-dsh-plugin-memory/main/docs/assets/webui-v0.5.32/en/memory.gif" alt="The Memory System: status, runtime memory, a document, the Memory Spaces graph, then an Agent answer with citations" width="880" /></a>
</p>

**Compose memory on the Plugins page.** One main strategy, its memory sources and optional enhancements, each switch applying at once. Every component has its own page, and storage, backup and interface settings live here too.

<p align="center">
  <a href="https://github.com/suveng/suveng-dsh-plugin-memory/blob/main/docs/en/guides/ui-guide.md#on-the-plugins-page"><img src="https://raw.githubusercontent.com/suveng/suveng-dsh-plugin-memory/main/docs/assets/webui-v0.5.32/en/plugins.gif" alt="DSH's Plugins page, then suveng-dsh-plugin-memory's page: memory composition, the main strategy menu, the Layered strategy's and Memory Spaces' pages, then storage and interface" width="880" /></a>
</p>

Every step is explained in the [UI guide](https://github.com/suveng/suveng-dsh-plugin-memory/blob/main/docs/en/guides/ui-guide.md); all screens, recordings and the capture environment are in the [v0.5.32 gallery](https://github.com/suveng/suveng-dsh-plugin-memory/blob/main/docs/assets/webui-v0.5.32/README.md).

## Three kinds of memory

| Memory | Keep here | How it reaches the Agent |
|---|---|---|
| **Runtime memory** | Preferences, working agreements, facts needed on the next turn | Injected every turn as compact USER.md and MEMORY.md |
| **Project Documents** | Designs, investigations, procedures and handoffs | Searched first, then read when relevant |
| **Memory Spaces** | Durable facts, decisions, entities and their relationships | Recalled on demand from the enabled Providers |

The default **Layered strategy** keeps runtime memory resident and reads the other two on demand. The **General strategy** offers every available source within one budget and lets the model decide how to use each. A **memory space** is one named, Provider-backed scope for long-term evidence; the Chinese product term is 记忆空间.

## Skills that improve with use

**Skills** is an experimental component for the `SKILL.md` skills DSH loads from your project and your home folder. Its page sits in the Memory System, or in the sidebar on its own.

| A turn's review suggests an improvement | You adopt it after a backtest |
|---|---|
| [![The Turn skills line under a reply: release-notes, suggested 1](https://raw.githubusercontent.com/suveng/suveng-dsh-plugin-memory/main/docs/assets/skills-v0.5.34/en/chat-skills.jpg)](https://github.com/suveng/suveng-dsh-plugin-memory/blob/main/docs/en/guides/skills.md#in-a-conversation) | [![A draft of release-notes with its backtest, Current 40 → Draft 93 +53, and the diff](https://raw.githubusercontent.com/suveng/suveng-dsh-plugin-memory/main/docs/assets/skills-v0.5.34/en/skills-draft.jpg)](https://github.com/suveng/suveng-dsh-plugin-memory/blob/main/docs/en/guides/skills.md#evolution) |

- **Manage.** Switch a skill off for the model or the `/` menu, use it in the conversation in one click, edit it, and go back to any earlier version.
- **Evolve.** With self-evolution on, finished conversations are reviewed in the background for corrections, "from now on" instructions, failed tools and reusable procedures. A suggestion cites the steps it rests on; a task Agent drafts the new `SKILL.md`, which is backtested against the current version before you adopt it. Nothing changes without your **Adopt**.
- **Test.** Each skill has its own cases, from reviews, from recorded conversations or written by hand, and a backtest scores any version on them.
- **Install.** The market searches skills.sh's open index and reads any GitHub repository, any site publishing an Agent Skills discovery index, and curated catalogs; every install is previewed, with security reviews where they exist.
- **In the conversation.** A line under each turn names the skills it used and what its review suggested, each one click from its page.

Self-evolution stays off until you turn it on under **Plugins → suveng-dsh-plugin-memory → Skills**. The [Skills guide](https://github.com/suveng/suveng-dsh-plugin-memory/blob/main/docs/en/guides/skills.md) walks through every screen.

## Quick start

DSH loads the bundled `cordis.patch.yml` automatically. Do not copy its `insert` block into your profile: duplicate Memory entries prevent Settings from saving. See [manual-installation recovery](docs/en/guides/installation.md#settings-cannot-save-after-manual-installation) if you already copied it.

### Installing this fork

This repository is maintained on its own and is **not published to npm**: every package is renamed to the `suveng-dsh-plugin-memory-*` convention, so a profile can only resolve them from a checkout.

```sh
git clone https://github.com/suveng/suveng-dsh-plugin-memory.git
cd suveng-dsh-plugin-memory
node scripts/install-profile.mjs --profile web
```

The script builds every workspace package, links the root and its 18 sub-packages into `~/.dsh/profiles/<profile>`, writes the matching `overrides:` there so pnpm never asks the registry for a renamed package, appends `suveng-dsh-plugin-memory` to `dsh.profile.bundles`, and drops the sub-packages from that list again (listing them duplicates the Entry ids and Settings stops saving). It then prints the two manual steps left: point the profile's `cordis.patch.yml` at `- id: memory` / `name: suveng-dsh-plugin-memory`, and move `~/.mnemon` to `~/.suveng-dsh-plugin-memory` — the plugin still reads the old path, so an existing memory survives either way.

New to DSH? [Install and start](https://github.com/suveng/suveng-dsh-plugin-memory/blob/main/docs/en/guides/installation.md) walks from an empty machine to your first memory, with a screenshot for every step. The short version, with [Node.js](https://nodejs.org/) 22.19 or later:

```sh
npm install --global pnpm
npx @deepseek-ai/dsh web
```

<p align="center">
  <a href="https://github.com/suveng/suveng-dsh-plugin-memory/blob/main/docs/en/guides/installation.md"><img src="https://raw.githubusercontent.com/suveng/suveng-dsh-plugin-memory/main/docs/assets/install-v0.5.19/en/install.gif" alt="On the Plugins page: Add plugin, type suveng-dsh-plugin-memory, Install, Enable now; the Memory System appears in the sidebar" width="880" /></a>
</p>

1. In the page that opens, click **Plugins → Add plugin**, type `suveng-dsh-plugin-memory`, click **Install**, then **Enable now**.
2. Open **Memory System** in the sidebar. **Status** shows each memory component and Provider.
3. Tell a conversation something to remember. The turn memory bar under the reply lists what the turn read and wrote, and the brain mark saves a reply to memory.
4. For Memory Spaces, install the Memory CLI for Mnemon Native with `npm install --global @mnemon-dev/mnemon`, or enable another Provider on the Memory Spaces page.
5. Choose the main strategy and enhancements under **Plugins → suveng-dsh-plugin-memory**.

suveng-dsh-plugin-memory supports DSH `0.2.1-rc.2` (npm `latest` and `next`) and `0.2.0-rc.2`. The same package serves the desktop app's Plugins page, `dsh plugin --profile web add suveng-dsh-plugin-memory` on the command line, and Headless with `dsh plugin --profile headless add suveng-dsh-plugin-memory`; older hosts keep the release [compatibility and upgrades](https://github.com/suveng/suveng-dsh-plugin-memory/blob/main/docs/en/reference/compatibility.md) names for them. [Getting started](https://github.com/suveng/suveng-dsh-plugin-memory/blob/main/docs/en/guides/getting-started.md) continues from here, and [compatibility and upgrades](https://github.com/suveng/suveng-dsh-plugin-memory/blob/main/docs/en/reference/compatibility.md) covers existing installations.

## How it works

[![Source facts flow through a Strategy and Core validation into one View for the DSH Host](https://raw.githubusercontent.com/suveng/suveng-dsh-plugin-memory/main/docs/assets/diagrams/en/composable-memory.png)](https://github.com/suveng/suveng-dsh-plugin-memory/blob/main/docs/en/development/architecture.md)

- **Sources** own memory and its operations: Runtime memory, Project Documents and Memory Spaces, whose Providers are its children.
- A **Strategy** decides how the available Sources take part in a turn: what stays resident, what can be searched, and which tools and budgets apply. Enhancements add to it through standard slots.
- **Core** validates the result into one immutable **View** for the turn. The DSH Host pins it to that turn and controls tool access.

The same public contracts serve the shipped plugins and external repositories. [Architecture](https://github.com/suveng/suveng-dsh-plugin-memory/blob/main/docs/en/development/architecture.md) explains ownership, the turn lifecycle and the UI regions components contribute to.

## Official plugins

The Starter pins a tested combination of independently versioned packages. One main strategy runs at a time; the enhancements are off until you turn them on.

| Package | Role | Default |
|---|---|---|
| [suveng-dsh-plugin-memory-source-runtime](https://github.com/suveng/suveng-dsh-plugin-memory/blob/main/plugins/suveng-dsh-plugin-memory-source-runtime/README.md) | Runtime memory: USER.md, MEMORY.md, revisions and local storage | On |
| [suveng-dsh-plugin-memory-source-documents](https://github.com/suveng/suveng-dsh-plugin-memory/blob/main/plugins/suveng-dsh-plugin-memory-source-documents/README.md) | Project Documents: Markdown, search, revisions and archiving | On |
| [suveng-dsh-plugin-memory-source-memory-spaces](https://github.com/suveng/suveng-dsh-plugin-memory/blob/main/plugins/suveng-dsh-plugin-memory-source-memory-spaces/README.md) | Memory Spaces: durable evidence and their Providers | On |
| [suveng-dsh-plugin-memory-source-skills](https://github.com/suveng/suveng-dsh-plugin-memory/blob/main/plugins/suveng-dsh-plugin-memory-source-skills/README.md) | Skills (experimental): DSH skills with versions, self-evolution from real conversations, tests and backtests, and a market of skills.sh, GitHub and Agent Skills sites | On (self-evolution off) |
| [suveng-dsh-plugin-memory-strategy-default-three-tier](https://github.com/suveng/suveng-dsh-plugin-memory/blob/main/plugins/suveng-dsh-plugin-memory-strategy-default-three-tier/README.md) | Layered strategy: resident runtime memory, the rest on demand | Selected |
| [suveng-dsh-plugin-memory-strategy-general](https://github.com/suveng/suveng-dsh-plugin-memory/blob/main/plugins/suveng-dsh-plugin-memory-strategy-general/README.md) | General strategy: every available source in one budget | Off |
| [suveng-dsh-plugin-memory-strategy-auto-capture](https://github.com/suveng/suveng-dsh-plugin-memory/blob/main/plugins/suveng-dsh-plugin-memory-strategy-auto-capture/README.md) | Active capture: in-turn guidance to keep useful facts | Off |
| [suveng-dsh-plugin-memory-strategy-light-context](https://github.com/suveng/suveng-dsh-plugin-memory/blob/main/plugins/suveng-dsh-plugin-memory-strategy-light-context/README.md) | Light context: a shared ceiling on resident context | Off |
| [suveng-dsh-plugin-memory-strategy-scoped](https://github.com/suveng/suveng-dsh-plugin-memory/blob/main/plugins/suveng-dsh-plugin-memory-strategy-scoped/README.md) | Scoped composition: ordered sources and a writable subset | Off |

Memory Spaces Providers: [Mnemon Native](https://github.com/suveng/suveng-dsh-plugin-memory/blob/main/plugins/suveng-dsh-plugin-memory-provider-native/README.md) (default, local) · [OpenViking](https://github.com/suveng/suveng-dsh-plugin-memory/blob/main/plugins/suveng-dsh-plugin-memory-provider-openviking/README.md) · [Honcho](https://github.com/suveng/suveng-dsh-plugin-memory/blob/main/plugins/suveng-dsh-plugin-memory-provider-honcho/README.md) · [Mem0](https://github.com/suveng/suveng-dsh-plugin-memory/blob/main/plugins/suveng-dsh-plugin-memory-provider-mem0/README.md) · [Hindsight](https://github.com/suveng/suveng-dsh-plugin-memory/blob/main/plugins/suveng-dsh-plugin-memory-provider-hindsight/README.md) · [Holographic](https://github.com/suveng/suveng-dsh-plugin-memory/blob/main/plugins/suveng-dsh-plugin-memory-provider-holographic/README.md) · [RetainDB](https://github.com/suveng/suveng-dsh-plugin-memory/blob/main/plugins/suveng-dsh-plugin-memory-provider-retaindb/README.md) · [ByteRover](https://github.com/suveng/suveng-dsh-plugin-memory/blob/main/plugins/suveng-dsh-plugin-memory-provider-byterover/README.md) · [Supermemory](https://github.com/suveng/suveng-dsh-plugin-memory/blob/main/plugins/suveng-dsh-plugin-memory-provider-supermemory/README.md). Third-party Providers stay off until configured; graph, deletion and enumeration capabilities differ by backend. See [Providers](https://github.com/suveng/suveng-dsh-plugin-memory/blob/main/docs/en/guides/memory-providers.md).

## Build your own

Define a Source or Strategy with `suveng-dsh-plugin-memory/extension-sdk`, add an enhancement through the standard slots, or write a Memory Spaces driver with `suveng-dsh-plugin-memory-source-memory-spaces/provider-sdk`. A component can also add its own settings and Status card to the pages suveng-dsh-plugin-memory shows. Your repository owns its manifest, dependencies, tests and build; DSH installs and mounts it, and choosing it as the main strategy is a separate decision.

Start with the [plugin author guide](https://github.com/suveng/suveng-dsh-plugin-memory/blob/main/docs/en/development/extensions.md). Discuss new capabilities and Providers in an Issue before a pull request; see [CONTRIBUTING](https://github.com/suveng/suveng-dsh-plugin-memory/blob/main/CONTRIBUTING.md).

## Data and trust

- Runtime memory and Project Documents are local files; Mnemon Native is local. Third-party Providers use their own services and scopes.
- Turning a component off does not erase its memory, and changing the storage location does not move data. Use ZIP backup to carry it.
- Skills keeps its evolution data (suggestions, test cases and the conversations reviews read, with secrets redacted) in the local storage root, outside backups. An Agent follows a skill from the market as written, so preview it before installing.
- Git sync publishes the same Memory Pack payload as readable files to a repository you own, so another machine can pull it, with **Sync now**, **Check remote** before anything is written, or **Automatic sync**. When two machines wrote one subject differently, both wordings stay until you accept and apply a **Memory reconciliation** plan; see [Git repository sync](https://github.com/suveng/suveng-dsh-plugin-memory/blob/main/docs/en/guides/operations.md#git-repository-sync).
- Saved Provider credentials stay on the Host and are never exported. Backups still contain private memory; protect them.
- Sources and Strategies are trusted in-process JavaScript, not sandboxed code. Remembered history never outranks current instructions.

[Backup and recovery](https://github.com/suveng/suveng-dsh-plugin-memory/blob/main/docs/en/guides/operations.md) · [Security policy](https://github.com/suveng/suveng-dsh-plugin-memory/blob/main/SECURITY.md) · [Release history](https://github.com/suveng/suveng-dsh-plugin-memory/blob/main/docs/en/releases/README.md) · [Roadmap](https://github.com/suveng/suveng-dsh-plugin-memory/blob/main/docs/en/roadmap.md)

## Develop and verify

```sh
pnpm install --frozen-lockfile
pnpm verify
pnpm verify:plugins
```

Use Node.js `^22.19.0 || >=24.0.0` and pnpm. `node scripts/serve-e2e.mjs` starts a disposable real WebUI; add `--docs-demo` for the seeded project behind these screenshots, and `--live-model` to have the DeepSeek API answer, with the key read from `DEEPSEEK_API_KEY`. Mechanical tests are not claims about model accuracy or live cloud Providers. [Development and verification](https://github.com/suveng/suveng-dsh-plugin-memory/blob/main/docs/en/development/README.md).

## Star History

<a href="https://www.star-history.com/?repos=omdsh-dev%2Fsuveng-dsh-plugin-memory&type=timeline&legend=bottom-right">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=suveng/suveng-dsh-plugin-memory&type=timeline&theme=dark&legend=bottom-right" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=suveng/suveng-dsh-plugin-memory&type=timeline&legend=bottom-right" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=suveng/suveng-dsh-plugin-memory&type=timeline&legend=bottom-right" />
 </picture>
</a>

## License

[MIT](https://github.com/suveng/suveng-dsh-plugin-memory/blob/main/LICENSE). Third-party providers keep their own licenses and terms; see [Third-party notices](https://github.com/suveng/suveng-dsh-plugin-memory/blob/main/THIRD_PARTY_NOTICES.md).
