import type { APIRoute } from 'astro';
import { current } from 'virtual:ditana/release';
import template from '../og-image/template.svg?raw';
import { ogImageSvg, renderPng } from '../og-image/render.mjs';

export const GET: APIRoute = () =>
    new Response(renderPng(ogImageSvg(template, current.name)), {
        headers: { 'Content-Type': 'image/png' },
    });
