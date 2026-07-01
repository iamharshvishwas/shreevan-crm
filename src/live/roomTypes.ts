/* Shared types + UI for in-room chat and polls, used by both the learner room
 * (/live) and the host room (/teach). */

export interface ChatMessage {
  id: string;
  authorName: string;
  isHost: boolean;
  body: string;
  createdAt: string;
}

export interface PollOptionView {
  id: string;
  text: string;
  votes: number;
}

export interface PollView {
  id: string;
  question: string;
  isOpen: boolean;
  totalVotes: number;
  options: PollOptionView[];
  myOptionId: string | null;
}

/** Chat actions a room provides (learner or host). */
export interface ChatApi {
  list: () => Promise<ChatMessage[]>;
  send: (body: string) => Promise<unknown>;
}

/** Poll actions — votes (learner) and create/close (host) are optional by role. */
export interface PollApi {
  get: () => Promise<PollView | null>;
  vote?: (optionId: string) => Promise<unknown>;
  create?: (question: string, options: string[]) => Promise<unknown>;
  close?: () => Promise<unknown>;
}
