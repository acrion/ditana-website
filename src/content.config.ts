import { defineCollection } from 'astro:content';
import { docsLoader, i18nLoader } from '@astrojs/starlight/loaders';
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema';
import { draftUnlessReleased, releaseNotesExtension } from './release/schema.mjs';

const schema = docsSchema({ extend: releaseNotesExtension });

export const collections = {
	docs: defineCollection({
		loader: docsLoader(),
		schema: (context) => schema(context).transform(draftUnlessReleased),
	}),
	i18n: defineCollection({ loader: i18nLoader(), schema: i18nSchema() }),
};
