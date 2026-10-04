// Contact form: validates, sends the message to your inbox through an email-forwarding service, and
// reports sending / sent / error. A static site has no server of its own, so the message is posted to:
//   - Web3Forms  (https://web3forms.com)  when `form.accessKey` is set in site.config.js, or
//   - FormSubmit (https://formsubmit.co)  otherwise: no key needed, but the FIRST message you ever send
//     makes FormSubmit email you an "activate this form" link, which you click once.
// A hidden "website" field is a spam trap: bots fill it in, people never see it.

import { ICON } from "./ui.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function postJSON(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

async function deliver(cfg, { name, email, message }) {
  const subject = `${cfg.subject}${name ? ` from ${name}` : ""}`;

  if (cfg.accessKey) {
    const { ok, data } = await postJSON("https://api.web3forms.com/submit", {
      access_key: cfg.accessKey,
      subject,
      from_name: name || "Portfolio visitor",
      name: name || "(no name given)",
      email,
      message,
      botcheck: "",
    });
    if (ok && data.success) return;
    throw new Error(data.message || "The message could not be sent");
  }

  const { ok, data } = await postJSON(`https://formsubmit.co/ajax/${encodeURIComponent(cfg.toEmail)}`, {
    name: name || "(no name given)",
    email,
    message,
    _subject: subject,
    _template: "table",
    _captcha: "false",
  });
  if (ok && (data.success === true || data.success === "true")) return;
  throw new Error(data.message || "The message could not be sent");
}

export function bindContactForm(form, cfg, illustration) {
  const status = form.querySelector(".form-status");
  const button = form.querySelector(".send-btn");
  const label = button.querySelector(".lbl");
  const icon = button.querySelector(".send-icon");
  const fields = {
    name: form.elements.name,
    email: form.elements.email,
    message: form.elements.message,
    trap: form.elements.website,
  };
  let resetTimer = null;

  const setState = (state, text = "", html = false) => {
    button.dataset.state = state;
    button.disabled = state === "sending";
    label.textContent = { idle: "Send", sending: "Sending…", sent: "Message sent!", error: "Try again" }[state];
    icon.innerHTML = state === "sent" ? ICON.check : ICON.plane;
    status.dataset.kind = state === "error" ? "error" : state === "sent" ? "ok" : "";
    illustration?.classList.toggle("sending", state === "sending");
    illustration?.classList.toggle("sent", state === "sent");
    if (html) status.innerHTML = text;
    else status.textContent = text;
  };

  const invalid = (field, text) => {
    field.setAttribute("aria-invalid", "true");
    field.focus();
    setState("error", text);
    button.dataset.state = "idle"; // a validation problem is not a failed send
    label.textContent = "Send";
  };

  const clearInvalid = () => {
    Object.values(fields).forEach((f) => f?.removeAttribute?.("aria-invalid"));
    if (button.dataset.state === "idle") status.textContent = "";
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (button.disabled) return;
    clearTimeout(resetTimer);
    clearInvalid();

    const name = fields.name.value.trim();
    const email = fields.email.value.trim();
    const message = fields.message.value.trim();

    if (fields.trap.value) { // a bot: pretend it worked
      setState("sent", "Thanks! I'll get back to you soon.");
      return;
    }
    if (!EMAIL_RE.test(email)) return invalid(fields.email, "Please enter a valid email so I can reply.");
    if (message.length < 5) return invalid(fields.message, "Please write a short message.");

    setState("sending", "");
    try {
      await deliver(cfg, { name, email, message });
      form.reset();
      setState("sent", "Thanks! Your message is on its way. I'll reply by email soon.");
      resetTimer = setTimeout(() => setState("idle", ""), 7000);
    } catch (err) {
      console.warn("Contact form error:", err);
      setState(
        "error",
        `Sorry, that didn't go through. Please try again, or email me directly at <a href="mailto:${cfg.toEmail}">${cfg.toEmail}</a>.`,
        true
      );
    }
  };

  const light = () => illustration?.classList.add("lit");
  const dim = () => illustration?.classList.remove("lit");

  form.addEventListener("submit", onSubmit);
  form.addEventListener("input", clearInvalid);
  form.addEventListener("focusin", light);
  form.addEventListener("focusout", dim);

  if (import.meta.env.DEV && !cfg.accessKey) {
    console.info(
      "[contact form] No Web3Forms access key set, so messages go through FormSubmit. Send one test message, " +
        "then click the activation link FormSubmit emails you. (Or paste a free key from web3forms.com into site.config.js.)"
    );
  }

  return () => {
    clearTimeout(resetTimer);
    form.removeEventListener("submit", onSubmit);
    form.removeEventListener("input", clearInvalid);
    form.removeEventListener("focusin", light);
    form.removeEventListener("focusout", dim);
  };
}
