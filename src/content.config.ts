import { defineCollection } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { draftUnlessReleased, releaseNotesExtension } from './release/schema.mjs';

const schema = docsSchema({ extend: releaseNotesExtension });

export const collections = {
	docs: defineCollection({
		loader: docsLoader(),
		schema: (context) => schema(context).transform(draftUnlessReleased),
	}),
};
