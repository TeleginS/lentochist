import { handleJudge } from '@/lib/ai/chain';
import type { JudgeRequest } from '@/lib/ai/messages';

export default defineBackground(() => {
  browser.action.onClicked.addListener(() => {
    void browser.runtime.openOptionsPage();
  });

  browser.runtime.onMessage.addListener((message: JudgeRequest, _sender, sendResponse) => {
    if (message?.type !== 'judge') return;
    void handleJudge(message).then(sendResponse);
    return true; // keep the channel open for the async answer
  });
});
