// Gate releases with the same complete creation-to-reading flow used by the exhaustive browser suite.
import test from 'node:test';
import {creationLifecycle} from './fixtures/creation-lifecycle.mjs';
test('STORY-LIFECYCLE-C001: create, wait, extract, edit preparation, confirm and read',{timeout:180000},creationLifecycle);
