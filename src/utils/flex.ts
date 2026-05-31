/**
 * Small helpers to build LINE messages (text + a couple of flex templates).
 * Kept intentionally minimal; expand as the UI grows.
 */

import type { Level } from '../types';

export function textMessage(text: string) {
  return { type: 'text', text };
}

/** A compact "your level" bubble shown when a member asks about their tier. */
export function levelCardMessage(memberName: string, level: Level | null) {
  const name = level?.name ?? 'Member';
  const color = level?.color ?? '#666666';
  const perks = level?.perks ?? 'Welcome to the community!';

  return {
    type: 'flex',
    altText: `Your level: ${name}`,
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: memberName || 'Member', size: 'sm', color: '#999999' },
          { type: 'text', text: name, weight: 'bold', size: 'xxl', color },
          { type: 'separator', margin: 'md' },
          { type: 'text', text: perks, wrap: true, margin: 'md', size: 'sm' },
        ],
      },
    },
  };
}

/** A button that opens the LIFF profile inside LINE. */
export function profileButtonMessage(liffUrl: string) {
  return {
    type: 'flex',
    altText: 'Open your profile',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [{ type: 'text', text: 'Manage your community profile', wrap: true }],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            style: 'primary',
            action: { type: 'uri', label: 'Open profile', uri: liffUrl },
          },
        ],
      },
    },
  };
}
