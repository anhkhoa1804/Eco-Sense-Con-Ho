"use client";

import { useState } from "react";
import { ArrowUpRight, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDict } from "@/lib/i18n/client";

/**
 * The contact form — and it is deliberately a MAILTO composer, not a
 * submission.
 *
 * WHY NOT A REAL FORM POST. This project has no email provider configured
 * (no SMTP, no Resend/Postmark/SendGrid — verified against the dependency
 * tree and the API routes). A form that collects a name, an address and a
 * message and then says "sent" would be claiming a delivery that does not
 * happen, which is the single worst thing this product could do given that
 * its whole premise is not overstating what it can do.
 *
 * So the fields are real, the composition is real, and the send hands the
 * message to the visitor's own mail client with everything already filled
 * in. Nothing is stored, nothing is transmitted by us, and the button never
 * reports success it cannot observe.
 *
 * CONTACT IS NOT REPORT. A report is an environmental observation that
 * becomes a durable row in Supabase. This is a person wanting to reach the
 * team. They were being conflated; the two now sit side by side and say
 * which is which.
 */
export function ContactForm({ address }: { address: string }) {
  const dict = useDict();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const canSend = message.trim().length > 0;

  // Built at click time, not held in state: the body must reflect whatever is
  // in the fields at the moment the visitor sends.
  const mailtoHref = () => {
    const subject = name.trim() ? `${dict.contact.subject} — ${name.trim()}` : dict.contact.subject;
    const body = [
      message.trim(),
      "",
      "—",
      name.trim() ? `${dict.contact.name}: ${name.trim()}` : null,
      email.trim() ? `${dict.contact.email}: ${email.trim()}` : null,
    ]
      .filter((line) => line !== null)
      .join("\n");

    return `mailto:${address}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        window.location.href = mailtoHref();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="contact-name">{dict.contact.name}</Label>
          <Input
            id="contact-name"
            name="name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contact-email">{dict.contact.email}</Label>
          <Input
            id="contact-email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contact-message">{dict.contact.message}</Label>
        <textarea
          id="contact-message"
          name="message"
          required
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full rounded-md border border-border bg-card/60 px-3 py-2 text-sm leading-relaxed text-foreground outline-none transition-colors duration-[var(--motion-base)] placeholder:text-foreground-subtle hover:border-foreground-subtle focus-visible:ring-2 focus-visible:ring-accent"
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button type="submit" disabled={!canSend} className="gap-2">
          <Mail className="h-4 w-4" aria-hidden />
          {dict.contact.send}
        </Button>
        {/* Says exactly what the button does. A visitor who expects a web
            form to post somewhere deserves to know their mail client is
            about to open instead. */}
        <p className="text-xs leading-relaxed text-foreground-subtle">{dict.contact.mailtoNote}</p>
      </div>

      <p className="flex items-center gap-1.5 pt-1 text-xs text-foreground-subtle">
        <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <a href={`mailto:${address}`} className="text-accent underline-offset-2 hover:underline">
          {address}
        </a>
      </p>
    </form>
  );
}
