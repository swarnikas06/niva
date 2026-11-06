-- Expand proactive_actions.channel constraint to support browser push notifications
ALTER TABLE proactive_actions DROP CONSTRAINT IF EXISTS proactive_actions_channel_check;
ALTER TABLE proactive_actions ADD CONSTRAINT proactive_actions_channel_check CHECK (channel IN ('in_app', 'browser', 'web_push'));
