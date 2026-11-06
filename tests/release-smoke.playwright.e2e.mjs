// Release smoke shares the production creation-to-reading scenario with a separate evidence directory.
import test from 'node:test';
import {creationLifecycle} from './fixtures/creation-lifecycle.mjs';
test('STORY-LIFECYCLE-C001: create, wait, extract, edit preparation, confirm and read',{timeout:180000},t=>creationLifecycle(t,'release-C001'));
