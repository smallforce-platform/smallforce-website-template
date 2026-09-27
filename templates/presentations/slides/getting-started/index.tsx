import type { Page, SlideMeta } from '@open-slide/core';

export const meta: SlideMeta = {
  title: 'Your next presentation',
  createdAt: '2026-09-26T00:00:00Z',
};

const Cover: Page = () => (
  <div style={{ width: 1920, height: 1080, background: '#f6f4ee', color: '#182a25', padding: 112, boxSizing: 'border-box', fontFamily: '"Geist Variable", sans-serif' }}>
    <p style={{ margin: 0, fontSize: 30, letterSpacing: 5 }}>SMALLFORCE</p>
    <h1 style={{ margin: '170px 0 36px', fontSize: 144, lineHeight: 1.05, maxWidth: 1500 }}>Make your next<br />idea worth sharing.</h1>
    <p style={{ fontSize: 38, color: '#557067' }}>A starting canvas. Replace it with your story.</p>
  </div>
);

export const notes = ['Replace this starter with the customer’s presentation before sharing.'];
export default [Cover] satisfies Page[];
