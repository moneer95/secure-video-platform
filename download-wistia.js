/**
 * Wistia → local MP4s → auto-upload to your video platform (after each download).
 *
 * Run (repo root, Node 18+):
 *   node download-wistia.js
 *
 * Upload uses `backend/.env`: `ADMIN_KEY` + `PUBLIC_BASE_URL` (or `UPLOAD_API_BASE`).
 * If only `ADMIN_KEY` is set, API defaults to http://localhost:4000.
 * Override: UPLOAD_API_BASE=... ADMIN_KEY=...  |  Disable upload: SKIP_UPLOAD=1
 *
 * If Wistia fails, refresh `x-csrf-token` + `cookie` from the browser. Do not commit live cookies.
 *
 * Files save under `./downloads/` (override: WISTIA_DOWNLOAD_DIR=./my-folder).
 * Names: `{wistiaMediaId}-{sanitized-display-name}.mp4` (display name from Wistia).
 * If that path already exists, download (and upload) are skipped for that id.
 * To upload an existing file anyway: UPLOAD_IF_FILE_EXISTS=1
 *
 * Large uploads: streams the file (no 2 GiB readFile limit). From repo root run once:
 *   npm install
 *
 * Debug:
 *   DEBUG=1 node download-wistia.js          — extra detail + stack traces
 *   WISTIA_LOG_FILE=./wistia.log ...         — append same lines to a file
 */
const fs = require("fs");
const path = require("path");
const { pipeline } = require("stream/promises");

let FormDataStream;
try {
  FormDataStream = require("form-data");
} catch (e) {
  console.error(
    "[wistia] Missing package `form-data`. From the repo root run: npm install"
  );
  process.exit(1);
}

const VERBOSE = process.env.DEBUG === "1" || process.env.VERBOSE === "1";
const WISTIA_LOG_FILE = (process.env.WISTIA_LOG_FILE || "").trim();

const DOWNLOAD_DIR = path.isAbsolute(process.env.WISTIA_DOWNLOAD_DIR || "")
  ? process.env.WISTIA_DOWNLOAD_DIR
  : path.join(__dirname, process.env.WISTIA_DOWNLOAD_DIR || "downloads");

function ts() {
  return new Date().toISOString();
}

function writeLog(stream, prefix, args) {
  const parts = args.map((a) => {
    if (a instanceof Error) return a.stack || a.message;
    if (typeof a === "object") {
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    }
    return String(a);
  });
  const line = `[${ts()}] [wistia] ${prefix}${parts.join(" ")}`;
  stream(line);
  if (WISTIA_LOG_FILE) {
    try {
      fs.appendFileSync(WISTIA_LOG_FILE, line + "\n");
    } catch (e) {
      console.error(`[${ts()}] [wistia] (could not write WISTIA_LOG_FILE)`, e.message);
    }
  }
}

function log(...args) {
  writeLog((l) => console.log(l), "", args);
}

function logWarn(...args) {
  writeLog((l) => console.warn(l), "WARN ", args);
}

function logErr(...args) {
  writeLog((l) => console.error(l), "ERROR ", args);
}

function parseDotEnv(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const s = line.trim();
    if (!s || s.startsWith("#")) continue;
    const eq = s.indexOf("=");
    if (eq < 1) continue;
    const key = s.slice(0, eq).trim();
    let val = s.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const backendEnv = parseDotEnv(path.join(__dirname, "backend", ".env"));

const ADMIN_KEY_FOR_UPLOAD = (
  process.env.ADMIN_KEY ||
  backendEnv.ADMIN_KEY ||
  ""
).trim();

let UPLOAD_API_BASE = (
  process.env.UPLOAD_API_BASE ||
  backendEnv.UPLOAD_API_BASE ||
  backendEnv.PUBLIC_BASE_URL ||
  ""
).replace(/\/$/, "");

if (!UPLOAD_API_BASE && ADMIN_KEY_FOR_UPLOAD) {
  UPLOAD_API_BASE = "http://localhost:4000";
}

const AUTO_UPLOAD =
  process.env.SKIP_UPLOAD !== "1" &&
  Boolean(ADMIN_KEY_FOR_UPLOAD && UPLOAD_API_BASE);

async function readResponseText(res) {
  try {
    return await res.text();
  } catch (e) {
    return `(could not read body: ${e.message})`;
  }
}

function cookieHeaderFromLoginResponse(res) {
  if (typeof res.headers.getSetCookie === "function") {
    const list = res.headers.getSetCookie();
    if (list && list.length) return list.map((c) => c.split(";")[0]).join("; ");
  }
  const sc = res.headers.get("set-cookie");
  if (!sc) return "";
  return sc
    .split(/,(?=\s*[^=]+=)/)
    .map((part) => part.split(";")[0].trim())
    .join("; ");
}

async function loginToVideoPlatform(baseUrl, adminKey) {
  const url = `${baseUrl}/api/login`;
  log("POST", url);
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ apiKey: adminKey }),
  });
  const cookie = cookieHeaderFromLoginResponse(r);
  if (!r.ok) {
    const body = await readResponseText(r);
    logErr(`login HTTP ${r.status}`, body.slice(0, 2000));
    throw new Error(`Platform login failed: ${r.status} — ${body.slice(0, 200)}`);
  }
  if (!cookie) {
    const body = await readResponseText(r);
    logErr("login OK but no Set-Cookie header; body:", body.slice(0, 500));
    throw new Error("Platform login: no Set-Cookie (session not issued)");
  }
  if (VERBOSE) log("login Set-Cookie names:", cookie.split(";").map((s) => s.split("=")[0]).join(", "));
  return cookie;
}

async function uploadMp4ToPlatform(baseUrl, cookieHeader, filepath, title, category) {
  const name = path.basename(filepath);
  const st = fs.statSync(filepath);
  log("upload (streaming)", name, `bytes=${st.size}`, `title=${JSON.stringify(title)}`);

  const form = new FormDataStream();
  form.append("file", fs.createReadStream(filepath), {
    filename: name,
    contentType: "video/mp4",
  });
  form.append("title", title || path.basename(filepath, path.extname(filepath)));
  form.append("category", category || "");

  const url = `${baseUrl}/api/upload`;
  const r = await fetch(url, {
    method: "POST",
    headers: {
      Cookie: cookieHeader,
      ...form.getHeaders(),
    },
    body: form,
    duplex: "half",
  });
  const raw = await readResponseText(r);
  let data = {};
  try {
    data = JSON.parse(raw);
  } catch {
    data = {};
  }
  if (!r.ok) {
    logErr(`upload HTTP ${r.status} for ${name}`, raw.slice(0, 2000));
    throw new Error(data.error || `Upload failed: ${r.status} — ${raw.slice(0, 300)}`);
  }
  if (VERBOSE) log("upload response:", raw.slice(0, 500));
  return data;
}

const ids = ['2op44eeuk9', '593cxol0dt', 'sbn8ngh4h7', 'corirqh4tr', 'ilvbiy8rtw', 'pat3p3y0br', 'o991vvuw20', '8fwbf7gaxw', 'l4cq51i80s', 'ps99vo8jkf', '6482td3qpz', 'zzpql4qsql', 'taprwf8vwf', '1qr5wnc2yi', 'su5sa1k7ys', '9et980jdtc', '0vu0mmbill', 'rqtrtuysc3', 'm5yvhcieca', 'e4kcpe2l4d', 'wpo8miffda', 'k9cmmoh7ao', '6vxtan6wth', 'gqt2oulu94', '8ek391nbw2', 'f3w6kx7mys', 'b5u7x69que', '0zc9s2l0bu', 'tgi4iui2di', 'shwdjl7xny', 'j0avs76o5t', 'smli4h8tdd', 'ctvrbq09tu', 'w3fj5aorma', 'f4vb4xpscp', 'cvjjzt1140', 'e6h96vl842', 'ne9nqrfnui', 'kgvlwq1drp', 'spwq50z0fr', 'fh5s5vws2m', '53mj47o6cr', 'xh3fg0k3v0', '6ef9lfay9s', 'f6jwxamfj4', 'fm5a5ntg8r', '8gnq51w5ng', 'zhyn5s08nl', '1wqx7rzhkg', 'gjpkb7l3zi', 'q1jvc22kb1', 'qmvoc09sem', 'ehnkkus8xp', 'ei4eiyw4ql', 'j1bbzj95v4', '3m6eva2naz', 'ezmn98di82', 'wdytp60qgl', '9yclroxb8l', '1yvs4i1ctj', 'yhr1vqbii1', '42zoi8qtv7', 'yv3w6meani', 'nonsztjtg3', 'hny0y3342t', 'iaf40u6p43', 'yqddjmqclk', 'ckofyjbvhj', 'ejs212m9p9', 'j45x8ms09q', 'rc2on2blex', '4udnpawsp7', 'qgaxkt3oxi', 't2prqi3dl2', 'bro84g6k2y', 'q98o9ddpzv', 'qwdy1iixig', '7bygz0odjc', 'tdyo4aw4f8', '5pw1htuoqr', 'p75giyd6i5', 'fvmkbereqq', 'g93e3cbmqd', 'er8pxux1m1', 'lv7ecqt01v', 'kbkha66s6r', 'b6a28gdvkr', 'durbpdc6cr', 'x45kbqeda2', 'ngk661u5zh', 'ebow8ybsdm', 'ryss4yv5ug', 'd7pwpgqswd', 'j657lr1e93', '3nidmlukcp', '3r8ixyo17y', 's7hzjj1zq6', 'r2l0wd493c', 'm5qxia1aux', 'xix6f66pdi', 'hmgrowm6ub', 'jhs4foe72b', 'jhsjr7knrd', 'c8uqwpf86w', '4uxwslerz4', 't2imxtsad2', 'j6l70lrx69', 'o8lkaoeh95', '3bvhvsta40', 'pz363nnqk9', 'a92bzi2yvv', 'ypy1s6yydf', '0rg477db69', 'xyf39jug1z', 'sr9kb0kaqu', 'g5lq9i9t57', '12nicmaeo3', 'jaa7oeg3gr', 's4rz3mkfff', '6bz7oue6k9', '6a0drvimqc', 'fskhlvgcao', 'olki110p1n', 'h5yuz8q8sa', 'qpt1jxyffv', 've48io5p97', 'o7t6vsn23z', 'xrvcd7uqrg', 'vw7pz2logx', 'vagcxtvxlf', 'kp2r1ejk9h', '3g85i99irc', 'd8lt3sf679', 'g92wq71ob5', 'gzas0saio1', 'zx8w6si55b', 'aeinc3yoh3', 'xzjl8vvgac', 'zttp1sli4t', 'sn3491rjb4', 'h5erj0955b', '3q02l2loq8', 'ig2vj42yl1', '3w42qtesqs', '181kvm1sz6', '4sgwkpesv6', 'ttxhvmhcsc', 'xxdy23hr7k', '5f6szqyrx6', '38rrons5x4', '5nt1e5on8e', 'mulla8u728', 'ebwm0qslr2', 'u7th9kgb5v', 'i8n43o4cfp', 'np83px2fl7', '0z9h96kv66', 'tqkslmwrm9', '303iqlhn5s', '95doxp1mpx', 'vuov7q0qe3', 'xx7pxguxw2', '2bh9i2srwg', 'o3cre4bky4', 's4rlumfds9', '0crguw49w0', 'zwbvqq5kyt', 'z23xjo56qg', 'qpk3pnv8sa', 'mbz52tmyms', 'atedfdb65w', 'ziswz2k7vk', 'sz5eijmmk2', 'pzqs45pawl', 'ebhr4kin33', 'c3ahwyzbip', '264wq4s9d2', 'vd05f8w4cr', '54tba54e1i', 'o2ewp6ta9j', 'bmiyxqf11d', 'qss9b4axus', 'yt6oouz04w', 'lagtsvzzet', 'trrbxkk7cr', '362fg5jij3', 'hlbldh35wc', '76a31u67i9', 'qga87p7cmu', 'zwr60suzj1', 'c8uxn9k3le', 'kc2qlbf6wb', '1z97nnayrf', '4st4zzerkx', 'soemqxa3cb', 'u13dq4qt99', 'ixd0onuqxn', 'kmzuiw8c6x', 'ieoa7fqp64', '7dh94nthbk', '1pz1312z3i', 'gkq1dyj2zi', 'yua0y6jiju', 'a1rg3fozay', 'cs5mw9055s', 'vcw56ope3p', 'beag6z5uf5', 'x99oklg4rz', 'ibuis2so4l', 'zz7w5wspc6', '848p2k3dvu', '7ek8fyuoj5', 'z0cnajr16c', '6wva15r2hw', 'obmsdrovpr', '1sy33l4kx5', 'v7uz6yhk6f', '08yks1m044', '4g3ad7bk3g'];

const endpoint = "https://ea-dental.wistia.com/graphql?op=MediaDownloadables";

// ⚠️ paste your cookie + csrf from browser
const headers = {
  "content-type": "application/json",
  "x-csrf-token": "nfYmZiomvltc5XuH9VDAfTZgD6qdgsblUA8UhNMTovhC2soOA-KAZF1RzdE3OfJLeDPV32hehgaIQMi8AAJc4w",
  "cookie": "_ga_GQR109DZ3Y=GS2.1.s1758008871$o11$g0$t1758008871$j60$l0$h0; _ps_xid_kWtHqPLH_K2Z1=IWg1ZhowFQbcF1; _ps_partner_key_kWtHqPLH=37b67ad28cd7; _gsxidkWtHqPLHXarh=IWg1ZhowFQbcF1; _grsmpkkWtHqPLH=37b67ad28cd7; _ga=GA1.1.777577813.1769669664; _gcl_au=1.1.692972760.1769669665; growSumoPartnerKey=37b67ad28cd7; ps_partner_key=37b67ad28cd7; ps_rc_fallback=true; gsxid=IWg1ZhowFQbcF1; ps_xid=IWg1ZhowFQbcF1; _tt_enable_cookie=1; _ttp=01KG48G90EP9Y68NZBGA060PVS_.tt.1; signals-sdk-user-id=acda671a-67b4-4425-a753-fc63725c3c16; hubspotutk=967556a487014997c3410e53498ca32c; intercom-device-id-gqy3npgu=e7e230b4-2a2f-4776-9a3b-845dcd8507eb; _ex-m-home_page_hero_layout=control; _ex-m-home_page_hero_layout_tracking=0; _ga=GA1.3.777577813.1769669664; _ga_6SFED6CF4L=GS2.3.s1771079054$o1$g1$t1771079063$j51$l0$h0; __stripe_mid=8b611812-1207-4765-afc1-7120f119eb21570471; _twpid=tw.1773410051761.489185291317994; noticeable_uid_WYO8CZGPadfWDRRYjcbY=e9aa61f4-e211-4091-8b2b-a107e3ac03dc; __hssrc=1; _rdt_uuid=1769669665891.fe87b3ec-2a35-4605-b2c8-757466c381b0; _uetvid=ae6e6d00490d11efb31939df0beddebf; ttcsid=1773898989925::tvpjuDay8NCGzpafcp65.5.1773898990132.0; ttcsid_CN0J3GBC77UFJAETEE9G=1773898989925::RSQhunzcDC171Ir-i22M.5.1773898990132.0; __hstc=77521994.967556a487014997c3410e53498ca32c.1769669665472.1773904552184.1774706933540.9; _ga_8BXEJ8J25Y=GS2.1.s1774715262$o13$g1$t1774715264$j58$l0$h0; fs_uid=#tBi#50987bfc-e952-4a77-ac34-457d6021e3d9:7e439141-ac0c-497e-ae72-221b5acdc928:1774714892272::2#3c1cebdb#/1789544962; _sp_ses.2b40=*; intercom-session-gqy3npgu=UE1GRHQ5d3ptUGo5QzdVWXFrdkhUL29RQlVwZENDT2tzeXF3VEJEZGVyV3VZMisweENoREZQVlpjWU1UOU8xM0VYd2k4UHEyR21naW9HNEpwZjBLckhoT21vVURYR0VDZEtLMk1SbGhITmJLU3NpWW1wd05uaGM2aDhCNTAwaVRNYUV3dnR2WGllcE84aDlTU3VHSFdGVXJZK3ZSZXVIN0R2M2VVUnd3TDhIaHowb3UwVnhjUHpRSzJUUkQ4T2NVZUpWMG1ncTZTK204NmV0akwyVFlCZz09LS01UG5ubk9iaHRPU0hFMUFQa1F0K3pBPT0=--5fb30b56e7044fd5cbfd823b23191613293a6616; fs_lua=1.1774715449069; authenticity_token=ofiBn6yAUUJl-xx09yyyCchsu_PMm82ovU3vAF5d6p5-1G33hURvfWRPqiI1RYA_hj9hhjlHjUtlAjM4jUwUhQ; _w_session=QriY5w3HWB2TvuZIkpAOJ23YKKnPEkWwTbGeBUIEVtkGBt0SgFAhUVsW2GK5iOTM3PegfkTt4y0L14Hvz6%2Fh1nlxstsW9QZBFRKhH9Q34iqZ8LRFwn0bv%2FuB9jZr289pcwJcMG5QGPJBHwPl%2FfZRA%2BiSY0dxs78KG1carINxXH6ULNu3UkKcv%2Fc%2BpdTtCGEyWTwQDkgcJ3y6liJTJCeKiofTNUdt%2FJjmM15zJY0Q%2BX7B5OwFrIBAuK%2B3tnEJZ10cNnMdZYMqfPPGJpUIOnxTSfJceU3En1Sp8XbcEfDQMdZ%2FP43ykUkI5KQU%2FaK%2FWoGUMKOvSkgxan0166YipJfUgbyFjNI7VrZdbsOV62OOdMGNbp2AV1rIKDCwUUrdvHHuxvb%2BkH6fkcbeO9Z74triQjE21hxs2dQy960qOj69B3fAWAmxg7MzuP%2FuVW%2Bvnc%2B8IE%2B%2B5AYRLWKv8Y%2FMygg9t91lN6BJsyKnzAj1AkiwdloufHTPFofmAMtCjlwLPv1kL03OFRPS93%2BIP2Ye2OhU4hGCPIc%3D--UdDeVW97pQVLc7lx--Tewn52dBS872pllNA07vCw%3D%3D; _sp_id.2b40=01e7100a-6891-447a-bdfd-3fd896dd0555.1721750858.41.1774715575.1774711488.1ed5e186-06d5-495d-94de-10a3d33a1e29"
};




/********************* DOWNLOAD FUNCTION ************************/
async function downloadFile(url, filename) {
  if (VERBOSE) log("GET (download)", url.slice(0, 120) + (url.length > 120 ? "…" : ""));
  const res = await fetch(url, {
    headers: {
      "cookie": headers.cookie,
      "user-agent": "Mozilla/5.0",
      "accept": "*/*"
    }
  });

  if (!res.ok) {
    const hint = await readResponseText(res);
    logErr(`download HTTP ${res.status}`, hint.slice(0, 500));
    throw new Error(`Download HTTP ${res.status}`);
  }

  await pipeline(res.body, fs.createWriteStream(filename));
  const st = fs.statSync(filename);
  log("saved file size bytes=", st.size);
}

/********************* FILENAME BUILDER ************************/
function sanitizeDisplayNameForFile(displayName) {
  let s = (displayName || "video").replace(/[<>:"/\\|?*]+/g, "").trim();
  s = s.replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (s.length > 150) s = s.slice(0, 150);
  return s || "video";
}

/** `{mediaId}-{name-from-download}.{ext}` — id first so sorting/search by id is easy */
function buildFileName(file, id) {
  const ext = String(file.extension || "mp4").replace(/^\./, "");
  let namePart = sanitizeDisplayNameForFile(file.displayName);
  if (namePart.toLowerCase().endsWith(`.${ext}`)) {
    namePart = namePart.slice(0, -(ext.length + 1));
  }
  return `${id}-${namePart}.${ext}`;
}

/********************* SELECT BEST QUALITY ************************/
function selectBestFile(files) {
  const validFiles = files.filter(f =>
    f.width > 0 &&
    f.height > 0 &&
    !f.displayName?.toLowerCase().includes("storyboard") &&
    !f.displayName?.toLowerCase().includes("thumbnail")
  );

  return validFiles.reduce((best, current) => {
    if (current.displayName?.toLowerCase().includes("original")) {
      return current;
    }

    const bestPixels = (best.width || 0) * (best.height || 0);
    const currentPixels = (current.width || 0) * (current.height || 0);

    return currentPixels > bestPixels ? current : best;
  });
}

/********************* MAIN ************************/
(async () => {
  log("start", `ids=${ids.length}`, `AUTO_UPLOAD=${AUTO_UPLOAD}`, `UPLOAD_API_BASE=${UPLOAD_API_BASE || "(none)"}`);
  log(
    "config",
    `backend/.env exists=${fs.existsSync(path.join(__dirname, "backend", ".env"))}`,
    `ADMIN_KEY set=${Boolean(ADMIN_KEY_FOR_UPLOAD)}`,
    `SKIP_UPLOAD=${process.env.SKIP_UPLOAD || "(unset)"}`,
    `VERBOSE=${VERBOSE}`,
    WISTIA_LOG_FILE ? `logFile=${WISTIA_LOG_FILE}` : "logFile=(stdout only)",
    `downloadDir=${DOWNLOAD_DIR}`
  );

  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

  let platformCookie = "";
  if (AUTO_UPLOAD) {
    log("auto-upload enabled →", UPLOAD_API_BASE);
    try {
      platformCookie = await loginToVideoPlatform(UPLOAD_API_BASE, ADMIN_KEY_FOR_UPLOAD);
      log("logged in to video platform (session cookie OK)");
    } catch (e) {
      logErr("platform login failed — downloads still run, uploads skipped:", e);
    }
  } else if (process.env.SKIP_UPLOAD === "1") {
    log("auto-upload disabled (SKIP_UPLOAD=1)");
  } else if (!ADMIN_KEY_FOR_UPLOAD) {
    log("auto-upload off — add ADMIN_KEY to backend/.env to upload after each download");
  } else {
    log("auto-upload off");
  }

  for (const id of ids) {
    log("--- processing media id:", id);

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          operationName: "MediaDownloadables",
          variables: { mediaHashedId: id },
          query: `query MediaDownloadables($mediaHashedId: HashedId!) {
            media(hashedId: $mediaHashedId) {
              downloadableMediaFiles {
                nodes {
                  downloadUrl
                  displayName
                  extension
                  width
                  height
                }
              }
            }
          }`
        })
      });

      const rawGraphql = await readResponseText(res);
      let data;
      try {
        data = JSON.parse(rawGraphql);
      } catch (parseErr) {
        logErr(`Wistia response not JSON (HTTP ${res.status})`, rawGraphql.slice(0, 800));
        throw parseErr;
      }

      if (!res.ok) {
        logErr(`Wistia GraphQL HTTP ${res.status}`, rawGraphql.slice(0, 1500));
        throw new Error(`Wistia HTTP ${res.status}`);
      }

      if (data.errors && data.errors.length) {
        logErr("Wistia GraphQL errors:", data.errors);
      }

      if (VERBOSE) log("Wistia response keys:", Object.keys(data));

      const files = data?.data?.media?.downloadableMediaFiles?.nodes;

      if (!files || files.length === 0) {
        logWarn("no downloadable files for id=", id, "snippet=", rawGraphql.slice(0, 400));
        continue;
      }

      log("available versions:", files.map((f) => `${f.displayName} (${f.width}x${f.height})`).join(" | "));

      const bestFile = selectBestFile(files);

      log("selected:", bestFile.displayName);

      const filename = path.join(DOWNLOAD_DIR, buildFileName(bestFile, id));

      const alreadyThere = fs.existsSync(filename);
      if (alreadyThere) {
        const st = fs.statSync(filename);
        log("skip download (file exists)", filename, `bytes=${st.size}`);
      } else {
        log("downloading →", filename);
        await downloadFile(bestFile.downloadUrl, filename);
        log("saved:", filename);
      }

      const shouldUpload =
        platformCookie &&
        (!alreadyThere || process.env.UPLOAD_IF_FILE_EXISTS === "1");

      if (shouldUpload) {
        const title =
          (bestFile.displayName || "").replace(/[<>:"/\\|?*]+/g, "").trim() || id;
        const category =
          process.env.UPLOAD_CATEGORY || backendEnv.UPLOAD_CATEGORY || "";
        try {
          const up = await uploadMp4ToPlatform(
            UPLOAD_API_BASE,
            platformCookie,
            filename,
            title,
            category
          );
          log("uploaded to platform id=", up.id, "status=", up.status || "?");
        } catch (uploadErr) {
          logErr("upload failed for", filename, uploadErr);
        }
      } else if (platformCookie && alreadyThere) {
        log("skip upload (file already existed; set UPLOAD_IF_FILE_EXISTS=1 to upload anyway)");
      } else if (AUTO_UPLOAD) {
        logWarn("skip upload (no session cookie — login failed earlier)");
      }

    } catch (err) {
      logErr(`failed id=${id}`, err);
    }
  }

  log("all done");
})();