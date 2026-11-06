// 发布冒烟共用正式制作到阅读场景，证据目录与完整生命周期入口隔离。
import test from 'node:test';
import {creationLifecycle} from './fixtures/creation-lifecycle.mjs';
test('STORY-LIFECYCLE-C001: create, wait, extract, edit preparation, confirm and read',{timeout:180000},t=>creationLifecycle(t,'release-C001'));
