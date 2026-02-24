# BOINC Account Manager — Complete Research Summary

## What Is an Account Manager?

An Account Manager (AM) is a **web service that sits between BOINC volunteers and projects**. Instead of manually attaching to each project, a user logs into the AM once, and the BOINC client periodically syncs with it to get a list of projects to attach to.

We want the **BAM! model** (not Science United) — each user keeps their own identity, the AM creates separate accounts on each project with matching credentials.

---

## Architecture

```
Fresco (GUI) ──GUI RPC──> BOINC Client ──HTTP POST──> Account Manager Server
                                |                              |
                                |                    Web RPCs to projects:
                                |                    create_account.php
                                |                    lookup_account.php
                                v                    am_get_info.php
                          Project Schedulers          am_set_info.php
```

---

## What Must Be Built (Server-Side)

### 1. `GET /get_project_config.php`

Returns XML identifying this as an AM (not a project):

```xml
<project_config>
    <name>My Account Manager</name>
    <account_manager/>              <!-- THIS tag is what makes it an AM -->
    <min_passwd_length>6</min_passwd_length>
</project_config>
```

### 2. `POST /rpc.php` — The Core Endpoint

The BOINC client POSTs an `<acct_mgr_request>` XML containing:
- User credentials (`name` + `password_hash`, or `authenticator` token)
- Host identification (`host_cpid`, `domain_name`, hardware info)
- List of currently attached projects with status
- Global preferences, opaque state data

Server must respond with `<acct_mgr_reply>` containing:
- `<signing_key>` — RSA public key (required for security)
- `<account>` entries — each with project URL, URL signature, and authenticator
- `<repeat_sec>` — seconds until next sync (default 86400 = 1 day)
- Optional: global preferences, messages, opaque data

### 3. RSA Key Pair (1024-bit)

Every project URL sent must be **digitally signed**. Generate with BOINC's `crypt_prog`:

```bash
crypt_prog -genkey 1024 am_private_key am_public_key
crypt_prog -sign_string "https://project.example.com/" am_private_key
```

The client **rejects** unsigned project URLs and **rejects** key changes after initial setup.

### 4. User & Host Database

- Users: email, password hash, authenticator token
- Hosts: CPID, hardware info, last RPC time
- Account mappings: user → project authenticators
- Preferences, teams (optional)

### 5. Project Web RPC Client (BAM! Model)

For each project a user selects, the server calls:

| Endpoint | Purpose |
|---|---|
| `project/create_account.php?email_addr=X&passwd_hash=X&user_name=X` | Create user's account on the project |
| `project/lookup_account.php?email_addr=X&passwd_hash=X` | Find existing account |
| `project/am_get_info.php?account_key=AUTH` | Get account details |
| `project/am_set_info.php?account_key=AUTH&...` | Update preferences/info |

Password hash = `MD5(password + lowercase(email))`.

### 6. Web Interface

Users need a website to: register, log in, browse/select projects, manage preferences, view stats.

---

## Full Protocol Specification

### Authentication Flow

```
password_hash = MD5(password + lowercase(login_name))
```

- First RPC: client sends `name` + `password_hash`
- Server can return an `authenticator` token
- Subsequent RPCs: client sends the `authenticator` instead
- Password errors return `error_num = -206`

### BAM!-Specific Flow

1. User registers on the website, picks projects via checkboxes
2. User enters AM URL in BOINC client (or Fresco)
3. Client calls `get_project_config.php` → sees `<account_manager/>`
4. Client POSTs to `rpc.php` with credentials
5. Server:
   - Authenticates user
   - For each selected project, calls `create_account.php` or `lookup_account.php`
   - Signs each project URL with private key
   - Returns `<account>` entries with authenticators
6. Client attaches to each project using the returned authenticators
7. Repeats every `repeat_sec` seconds (typically daily)

---

## GUI RPC Commands (Fresco's Interface to BOINC Client)

### `acct_mgr_info` — Get current AM status

```xml
<!-- Request -->
<acct_mgr_info/>

<!-- Reply -->
<acct_mgr_info>
    <acct_mgr_url>URL</acct_mgr_url>
    <acct_mgr_name>NAME</acct_mgr_name>
    <have_credentials/>
    <cookie_required/>
    <cookie_failure_url>URL</cookie_failure_url>
</acct_mgr_info>
```

### `acct_mgr_rpc` — Initiate AM RPC (async)

```xml
<!-- Attach with credentials -->
<acct_mgr_rpc>
    <url>https://bam.boincstats.com</url>
    <name>user@example.com</name>
    <password>mypassword</password>
</acct_mgr_rpc>

<!-- Sync using stored config -->
<acct_mgr_rpc>
    <use_config_file/>
</acct_mgr_rpc>

<!-- Detach (empty URL) -->
<acct_mgr_rpc>
    <url></url>
    <name></name>
    <password></password>
</acct_mgr_rpc>
```

Returns `<success/>` immediately. Poll with `acct_mgr_rpc_poll` for results.

**Important:** Password is hashed as `md5(password + lowercase(name))` unless it starts with `"hash:"`.

### `acct_mgr_rpc_poll` — Poll AM RPC result

```xml
<!-- Request -->
<acct_mgr_rpc_poll/>

<!-- Reply -->
<acct_mgr_rpc_reply>
    <error_num>0</error_num>          <!-- 0 = success, -204 = in progress, -206 = bad password -->
    <message>Some message</message>
</acct_mgr_rpc_reply>
```

---

## AM RPC Request Format (`<acct_mgr_request>`)

Full XML sent by BOINC client to `AM_BASE_URL/rpc.php`:

```xml
<?xml version="1.0" encoding="UTF-8" ?>
<acct_mgr_request>
    <!-- Authentication (one of two methods) -->
    <authenticator>RANDOM_STRING</authenticator>
    <!-- OR -->
    <name>user@example.com</name>
    <password_hash>MD5_HASH</password_hash>

    <!-- Host identification -->
    <host_cpid>UNIQUE_HOST_ID</host_cpid>
    <previous_host_cpid>PREV_ID</previous_host_cpid>
    <domain_name>hostname</domain_name>

    <!-- Client info -->
    <client_version>7.24.1</client_version>
    <run_mode>auto</run_mode>       <!-- auto|always|never -->

    <!-- Platform support -->
    <platform_name>windows_x86_64</platform_name>
    <alt_platform>
        <name>windows_intelx86</name>
    </alt_platform>

    <!-- GUI RPC info (only if AM requested send_gui_rpc_info) -->
    <gui_rpc_port>31416</gui_rpc_port>
    <gui_rpc_password>PASSWORD</gui_rpc_password>

    <!-- Currently attached projects -->
    <project>
        <url>https://project.example.com/</url>
        <project_name>Project Name</project_name>
        <suspended_via_gui>0</suspended_via_gui>
        <hostid>12345</hostid>
        <not_started_dur>3600.0</not_started_dur>
        <in_progress_dur>7200.0</in_progress_dur>
        <attached_via_acct_mgr>1</attached_via_acct_mgr>
        <dont_request_more_work>0</dont_request_more_work>
        <detach_when_done>0</detach_when_done>
        <ended>0</ended>
        <resource_share>100.0</resource_share>
        <disk_usage>1000000.0</disk_usage>
        <disk_share>5000000.0</disk_share>
        <account_key>AUTH_KEY</account_key>  <!-- only if attached_via_acct_mgr -->
    </project>

    <!-- Working global preferences (currently active, including local overrides) -->
    <working_global_preferences>
        <!-- GLOBAL_PREFS XML -->
    </working_global_preferences>

    <!-- Web-based global preferences (from project/AM) -->
    <global_preferences>
        <!-- includes source_project, source_scheduler, mod_time -->
    </global_preferences>

    <!-- Host hardware/software info -->
    <host_info>
        <!-- Full HOST_INFO XML including coprocessor details -->
    </host_info>

    <!-- Opaque data from previous AM reply -->
    <opaque>
        <!-- arbitrary XML from AM -->
    </opaque>

    <!-- Time and network statistics -->
    <time_stats>...</time_stats>
    <net_stats>...</net_stats>
</acct_mgr_request>
```

---

## AM RPC Reply Format (`<acct_mgr_reply>`)

```xml
<acct_mgr_reply>
    <!-- Error handling -->
    <error_num>0</error_num>
    <error_msg>Description</error_msg>

    <!-- AM identity -->
    <name>My Account Manager</name>

    <!-- Authenticator (returned to client for future RPCs) -->
    <authenticator>RANDOM_AUTH_STRING</authenticator>

    <!-- User info -->
    <user_name>John Doe</user_name>
    <team_name>Team Name</team_name>

    <!-- REQUIRED: RSA public key for URL signature verification -->
    <signing_key>
    BASE64_ENCODED_PUBLIC_KEY
    </signing_key>

    <!-- Interval until next RPC (seconds); default 86400 = 1 day -->
    <repeat_sec>86400</repeat_sec>

    <!-- User-facing messages (can have multiple) -->
    <message>Welcome to our AM!</message>

    <!-- Global preferences (if newer than client's) -->
    <global_preferences>
        <!-- GLOBAL_PREFS XML with mod_time -->
    </global_preferences>

    <!-- Host venue assignment -->
    <host_venue>home</host_venue>

    <!-- Opaque data for client to return in next request -->
    <opaque>
        <host_id>42</host_id>
    </opaque>

    <!-- RSS feeds -->
    <rss_feeds>
        <rss_feed>
            <url>https://am.example.com/feed.xml</url>
            <poll_interval>86400</poll_interval>
        </rss_feed>
    </rss_feeds>

    <!-- Project accounts to attach/manage -->
    <account>
        <url>https://project1.example.com/</url>
        <url_signature>
RSA_SIGNATURE_OF_URL
        </url_signature>
        <authenticator>PROJECT_AUTH_KEY</authenticator>

        <!-- Control flags (all optional) -->
        <update>0</update>
        <detach>0</detach>
        <suspend>0</suspend>
        <abort_not_started>0</abort_not_started>
        <dont_request_more_work>0</dont_request_more_work>
        <detach_when_done>0</detach_when_done>
        <resource_share>100</resource_share>
        <no_rsc>NVIDIA</no_rsc>
    </account>
</acct_mgr_reply>
```

---

## Project Web RPC Details

### `create_account.php`

```
GET project_url/create_account.php?email_addr=X&passwd_hash=X&user_name=X
```

Response:
```xml
<account_out>
    <authenticator>xxx</authenticator>
</account_out>
```

### `lookup_account.php`

```
GET project_url/lookup_account.php?email_addr=X&passwd_hash=X
```

### `am_get_info.php`

```
GET project_url/am_get_info.php?account_key=AUTH
```

Response:
```xml
<am_get_info_reply>
    <success/>
    <id>ID</id>
    <name>NAME</name>
    <country>COUNTRY</country>
    <weak_auth>WEAK_AUTH</weak_auth>
    <global_prefs>PREFS_XML</global_prefs>
    <project_prefs>PREFS_XML</project_prefs>
    <teamid>N</teamid>
    <venue>X</venue>
</am_get_info_reply>
```

### `am_set_info.php`

```
POST project_url/am_set_info.php?account_key=AUTH&name=X&global_prefs=X...
```

### Error Codes

| Code | Meaning |
|---|---|
| `-1` | Generic error |
| `-112` | Invalid XML |
| `-136` | Not found |
| `-137` | Non-unique |
| `-183` | Project temporarily down |
| `-206` | Wrong password |
| `-208` | Account creation disabled |

---

## Security Notes

- **Signing key is mandatory** — client demands it in every successful reply
- **Key pinning** — once the client has a key, it rejects any different key (prevents MITM)
- **Weak vs strong authenticators** — weak auth (contains `_`) can only attach hosts; strong auth gives full access
- **Private key** should be on a physically secure, non-networked machine
- **Always use 1024-bit** keys (BOINC's `crypt_prog` requirement)

---

## Client-Side Local Files

| File | Purpose |
|---|---|
| `acct_mgr_url.xml` | AM identity, URL, signing key |
| `acct_mgr_login.xml` | Credentials, opaque data, next RPC time |
| `acct_mgr_reply.xml` | Cached last reply |

---

## Difficulty Assessment

### Component Breakdown

| Component | Effort | Notes |
|---|---|---|
| `get_project_config.php` | Trivial | Static XML, ~10 lines |
| `rpc.php` — XML parsing | Medium | Parse ~20 fields, validate auth |
| `rpc.php` — response building | Medium | Build XML with signed URLs |
| RSA key management | Low | Generate once, sign URLs with a library |
| User database + auth | Medium | Standard web app auth |
| Project Web RPC client | Medium | HTTP calls to ~4 project endpoints |
| Web interface | Medium-High | Registration, project selection, prefs, stats |
| Host tracking | Low-Medium | Match hosts by CPID/domain |
| Error handling + retry | Medium | Exponential backoff, project failures |

### Overall: Medium difficulty

This is a **standard web application** with a specialized XML API. The core protocol is well-documented and straightforward — XML in, XML out over HTTP POST.

**What makes it manageable:**
- Protocol is fully documented in BOINC wiki and source code
- Science United's PHP source is available as reference
- BAM! model is simpler than Science United (no dynamic scheduling needed)
- Client does most of the heavy lifting
- Only 2 server endpoints strictly required

**What takes the most effort:**
- **Web interface** — probably 50%+ of the work
- **Edge cases** — projects down, accounts existing, password changes, host migration
- **RSA signing** — not hard but must be correct (client is strict)
- **Project catalog** — maintaining a list of active BOINC projects

---

## Sources

- [BOINC/boinc Wiki: AccountManagement](https://github.com/BOINC/boinc/wiki/AccountManagement)
- [BOINC/boinc Wiki: Account_managers](https://github.com/BOINC/boinc/wiki/Account_managers)
- [BOINC/boinc Wiki: WebRpc](https://github.com/BOINC/boinc/wiki/WebRpc)
- [BOINC/boinc Wiki: KeySetup](https://github.com/BOINC/boinc/wiki/KeySetup)
- [BOINC/boinc Wiki: GuiRpcProtocol](https://github.com/BOINC/boinc/wiki/GuiRpcProtocol)
- [BOINC/boinc Wiki: GuiRpc](https://github.com/BOINC/boinc/wiki/GuiRpc)
- [BOINC/boinc Wiki: SimpleAttach](https://github.com/BOINC/boinc/wiki/SimpleAttach)
- [BOINC/boinc `client/acct_mgr.cpp`](https://github.com/BOINC/boinc/blob/master/client/acct_mgr.cpp)
- [BOINC/boinc `client/acct_mgr.h`](https://github.com/BOINC/boinc/blob/master/client/acct_mgr.h)
- [BOINC/boinc `lib/gui_rpc_client.h`](https://github.com/BOINC/boinc/blob/master/lib/gui_rpc_client.h)
- [davidpanderson/science_united](https://github.com/davidpanderson/science_united)
- [BAM! — BOINCstats](https://www.boincstats.com/bam/)
