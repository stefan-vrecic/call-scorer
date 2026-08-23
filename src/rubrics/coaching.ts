/**
 * Coaching call rubric, structured. Source of truth in prose:
 * exercise-reference/rubrics/coaching-call-rubric.md - re-read that file if
 * this ever needs re-deriving; don't paraphrase from memory of this file.
 *
 * Every dimension is discrete buckets only - no interpolation (discreteOnly:
 * true). D4 (Movement Coaching Quality) is the one dimension that can be
 * switched off entirely (disableDetectionCriteria); when it is, the total is
 * out of reducedTotalPoints (85), not totalPoints (100).
 *
 * KNOWN SOURCE DISCREPANCY: the rubric's own scope note claims "Total is 100
 * points when D4 is active, 85 when... D4 is switched off," but the 12
 * dimensions' own stated point values sum to 105 (verified against the
 * source file directly, not a transcription slip), and 105 - D4's 15 = 90,
 * not 85 either. totalPoints/reducedTotalPoints below are kept as the
 * rubric's own stated figures for reference, but scoring/applyRubricRules.ts
 * does NOT use them for maxPossible - it derives maxPossible from the sum of
 * the actually-scored dimensions' maxScore values instead, so a perfect call
 * always lands at exactly 100/100 regardless of which number the rubric's
 * summary line claims.
 *
 * SCOPE NOTE (deliberate, not an oversight): D2 (Diagnostics Review) also has
 * its own conditional-applicability rule in the source rubric - when not
 * applicable (non-milestone call, no video submitted), the rubric says to
 * score N/A and "redistribute weight to D3 and D4" rather than rescale the
 * denominator the way D4's disable does. That redistribution mechanic is a
 * second, differently-shaped rescale on top of D4's - deliberately out of
 * scope for this build. D2 is always scored normally here (Fail/Surface bands
 * naturally cover "no diagnostics happened"); see D4 for the one rescale this
 * app actually implements.
 */

import type { RubricContract } from "@/types/rubric";

export const coachingRubric: RubricContract = {
  callType: "coaching",
  totalPoints: 100,
  reducedTotalPoints: 85,
  discreteOnly: true,
  scoreBands: [
    { name: "Elite", min: 90, max: 100 },
    { name: "Strong", min: 80, max: 89 },
    { name: "Inconsistent", min: 70, max: 79 },
    { name: "At Risk", min: 60, max: 69 },
    { name: "Fail", min: 0, max: 59 },
  ],
  landingTest: {
    description:
      "Three-part test for every score: depth (how far the coach went), clarity (how well it landed), and client response (did it actually land). A perfect explanation the client didn't confirm is not Elite.",
    feelings: ["this is built for me", "I know exactly what to do", "I trust this process", "my coach is paying attention"],
  },
  automaticCaps: [
    {
      id: "next-call-not-booked-live",
      condition: "Next call NOT booked live during the call",
      signal: "nextCallBookedLive",
      firesWhenSignalIs: false,
      effect: { type: "zeroDimension", dimensionId: "D10", nonRecoverable: true },
    },
    {
      id: "no-long-term-vision",
      condition: "No connection to long-term vision at any point in the call",
      signal: "longTermVisionConnected",
      firesWhenSignalIs: false,
      effect: { type: "maxDimension", dimensionId: "D3", value: 10 },
    },
    {
      id: "coach-over-75pct-passive-client",
      condition: "Coach speaks >75% of the call (client passive/monologue)",
      signal: "coachSpeaksOver75PctPassiveClient",
      firesWhenSignalIs: true,
      effect: { type: "maxTotal", value: 75 },
    },
    {
      id: "no-concrete-accountability",
      condition:
        "No concrete accountability commitment the client owns before close - no specific, verifiable deliverable the client confirms",
      signal: "concreteAccountabilityCommitmentPresent",
      firesWhenSignalIs: false,
      effect: { type: "maxDimension", dimensionId: "D6", value: 10 },
    },
    {
      id: "struggle-ignored-or-avoided",
      condition: "Client struggle present but ignored or avoided",
      signal: "struggleIgnoredOrAvoided",
      firesWhenSignalIs: true,
      effect: { type: "zeroDimension", dimensionId: "D8", nonRecoverable: true },
    },
    {
      id: "no-action-steps-either-party",
      condition: "No action steps stated for either party before close",
      signal: "noActionStepsEitherParty",
      firesWhenSignalIs: true,
      effect: { type: "maxTotal", value: 70 },
    },
  ],
  dimensions: [
    {
      id: "D1",
      name: "Check-In & Connection",
      maxScore: 10,
      whatToLookFor:
        "Does the coach open with genuine curiosity and gauge the client's real state before anything else? Does the call intention get set explicitly?",
      bands: [
        {
          label: "Elite",
          min: 10,
          max: 10,
          criteria:
            "Coach asks about body, wins, AND struggles. Listens before responding - no interruption. Reflects what they hear back to the client (\"What I'm hearing is...\"). States clear call intention tied to client's actual state. Coach reads what kind of call is needed today and adjusts the approach accordingly.",
        },
        {
          label: "Strong",
          min: 7,
          max: 7,
          criteria: "Good questions but limited depth. Solid check-in, reflects but not fully. Call intention stated but generic (\"let's keep making progress on your goals\").",
        },
        {
          label: "Surface",
          min: 3,
          max: 3,
          criteria: "Surface-level: \"How's it going?\" Doesn't reflect. Moves to program topics within 30 seconds. No call intention stated.",
        },
        {
          label: "Fail",
          min: 0,
          max: 0,
          criteria: "Skips check-in entirely or rushes through. No acknowledgment of client's state. Launches directly into program content.",
        },
      ],
      positiveSignals: [
        "Coach adjusts call plan based on check-in answers",
        "Client opens up beyond surface level",
        "Intention is stated and tailored to this client's current moment",
      ],
      negativeSignals: ["\"Okay let's get started\"", "Monosyllabic client response and coach moves on", "No listening pause", "No call intention set"],
      calibrationNotes: [
        "\"The check-in is how you gauge what kind of call this person actually needs today. The framework is a container, not a script. If someone hops on in tears, you put the framework away. Meeting them where they're at IS the framework working.\"",
      ],
    },
    {
      id: "D2",
      name: "Diagnostics Review",
      maxScore: 10,
      whatToLookFor:
        "When applicable (milestone weeks 8/16/24), does the coach demonstrate expertise through specific, personalized feedback - not generic commentary? Is 1-2 movements reviewed (not more), tied directly to client goals? See file-level scope note: this app scores D2 normally rather than implementing the rubric's N/A-plus-redistribute mechanic.",
      bands: [
        {
          label: "Elite",
          min: 10,
          max: 10,
          criteria:
            "Screen shares 1-2 movements only (per SOP). Makes specific, anatomically precise observations. Directly ties findings to client's stated pain points and goals. Client clearly understands the connection. Coach selects movements that point back to client's why.",
        },
        {
          label: "Strong",
          min: 7,
          max: 7,
          criteria: "Good observations but not fully tied to goals. Expertise shown, context-linking incomplete. Reviews correct number of movements.",
        },
        {
          label: "Surface",
          min: 3,
          max: 3,
          criteria: "Reviews movements with generic feedback (\"Good effort, keep your back straight\"). No tie to client goals or pain points. Possibly reviews too many movements.",
        },
        {
          label: "Fail",
          min: 0,
          max: 0,
          criteria: "Skipped, rushed, or unclear. Feedback generic or absent. Personalization not visible.",
        },
      ],
      positiveSignals: ["Coach explicitly selects movements tied to client's presenting goal", "Anatomical specificity", "Client has a visible \"I didn't know that\" moment"],
      negativeSignals: ["\"Looks good overall\"", "Generic cues not connected to goals", "Reviews 5+ movements without focus"],
      calibrationNotes: [
        "\"One to two movements - not a hundred. Very specific. Always pick the movements that point back to the client's goals, their why.\"",
      ],
    },
    {
      id: "D3",
      name: "Program Focus + Vision",
      maxScore: 15,
      whatToLookFor:
        "Does the coach connect the current block to the client's 12-month vision and identity? Or do they only talk about this week? Auto-cap: no long-term vision connection anywhere in the call -> max 10.",
      bands: [
        {
          label: "Elite",
          min: 15,
          max: 15,
          criteria:
            "Clearly explains what the current block targets. Explicitly connects this phase to client's 12-month vision by name. Reinforces the Halden Method difference (\"We build from your diagnostics and goals - not random workouts\"). Client responds with belief or insight. Client leaves understanding not just WHAT but WHY this specific block, at this specific time, is the path to their specific goal.",
        },
        {
          label: "Strong",
          min: 10,
          max: 10,
          criteria: "Block explained and connected to goals but vision tie is generic (\"this builds toward your long-term health\"). Emotional resonance present but not sharp.",
        },
        {
          label: "Mid",
          min: 5,
          max: 5,
          criteria: "Vague explanation. Block explained as logistics only. Client understands what to do this week but not why it matters long-term. No 12-month vision referenced.",
        },
        {
          label: "Fail",
          min: 0,
          max: 0,
          criteria: "No explanation of block. Just \"keep doing your workouts.\" No connection to vision.",
        },
      ],
      positiveSignals: ["12-month vision referenced by name", "Client responds with buy-in or insight", "Block tied to previous and next phase"],
      negativeSignals: ["Only current week discussed", "\"Just keep going\"", "Client passive", "Reframe not attempted when client is confused"],
      calibrationNotes: [
        "\"Connect back to: why did they join? What's the progress they've made? And where are they going - not just where, but WHY are they going there?\" This is the #1 loss dimension in coaching call QC.",
        "Role play evidence (R.M. upset call): Marcus brought an upset client back around by returning to \"When you started, what were the most important things to you?\" and rebuilding vision from there. Elite coaches use vision as their reset tool, not just an opening frame.",
      ],
    },
    {
      id: "D4",
      name: "Movement Coaching Quality",
      maxScore: 15,
      optional: true,
      disableDetectionCriteria: [
        "Client performed any live movement during the call.",
        "Coach gave setup, breathing, or control cues in response to a movement.",
        "There was a video review of a recorded movement attempt with real-time feedback.",
        "Coach gave real-time form correction while the client moved.",
      ],
      whatToLookFor:
        "Does something actually improve or click during this call? Is the coach coaching - or just narrating? DISABLE this dimension (score: null, band: N/A) only when ALL FOUR of disableDetectionCriteria are absent from the call - if even one is present, score normally.",
      bands: [
        {
          label: "Elite",
          min: 15,
          max: 15,
          criteria:
            "Reviews 1-2 movements live. Specific cues given: setup, breathing, control. Asks reflective questions (\"Where do you feel this most?\" / \"What felt hardest here?\"). Improvement is observable or client verbally confirms a new understanding. Links back to goal. If client is a \"talker,\" coach redirects to live movement.",
        },
        {
          label: "Strong",
          min: 10,
          max: 10,
          criteria: "Clear coaching and relevant cues. Missing reflective questions or goal link. Client engaged but no breakthrough or redirection of talker dynamic.",
        },
        {
          label: "Mid",
          min: 5,
          max: 5,
          criteria: "Mostly telling (\"Keep your back straight, squeeze your glutes\"). No reflective questions. No back-and-forth coaching exchange.",
        },
        {
          label: "Fail",
          min: 0,
          max: 0,
          criteria: "No live coaching. Just commentary or \"looks fine.\" Client is a passive observer. Coach lets the call become purely talk without movement.",
        },
      ],
      positiveSignals: ["Client has an \"aha\" moment", "Coach adjusts cue based on client response", "Live exchange (back and forth)", "Talker redirected to movement"],
      negativeSignals: ["One-way monologue", "No client input solicited", "Client spends 8 minutes talking and no movement happens", "No goal link after coaching"],
      calibrationNotes: [
        "\"The best thing for the person who just wants to talk is probably going to be some movement... Elite coaches gently insist on live movement even with talkers.\"",
        "#3 loss dimension: coaches narrate instead of coaching. Without live exchange, reflective questions, and a goal link, the call becomes commentary - not real coaching.",
      ],
    },
    {
      id: "D5",
      name: "Adjustments & Strategy",
      maxScore: 10,
      whatToLookFor:
        "When adjustments are made - training or lifestyle - are they framed as intelligent, strategic progress? Or do they feel like a step backward? If no adjustments were needed this cycle, score 7/10 by default.",
      bands: [
        {
          label: "Elite",
          min: 10,
          max: 10,
          criteria:
            "Adjustments explained with clear rationale tied to the client's long game. Explicitly framed as protection and strategy (\"We're adapting - not backing off. This protects the long game.\"). Both training and lifestyle constraints addressed if applicable. Client leaves feeling smarter and more confident, not discouraged.",
        },
        {
          label: "Strong",
          min: 7,
          max: 7,
          criteria: "Adjustments made and explained. Framing present but brief. Client doesn't feel discouraged but isn't fully empowered.",
        },
        {
          label: "Surface",
          min: 3,
          max: 3,
          criteria: "Adjustments made without clear rationale. Client accepts changes but doesn't understand why. Subtle discouragement possible.",
        },
        {
          label: "Fail",
          min: 0,
          max: 0,
          criteria: "Reactive, unexplained changes. Client confused or mildly demoralized. No protective framing applied.",
        },
      ],
      positiveSignals: ["Client says \"Oh, that makes sense\"", "Adjustment tied to the bigger goal", "Coach explains what the adjustment builds toward"],
      negativeSignals: ["\"Let's reduce that for now\" with no explanation", "Client sounds apologetic or uncertain", "No protective framing"],
      calibrationNotes: [
        "Scoring note: if no adjustments are needed this cycle, score 7/10 by default - strategic awareness is still visible in how the coach communicates program status.",
      ],
    },
    {
      id: "D6",
      name: "Action Steps & Accountability",
      maxScore: 15,
      whatToLookFor:
        "Do both the coach AND client leave with specific, time-bound, measurable commitments? Is verbal ownership created - not just instructions given?",
      bands: [
        {
          label: "Elite",
          min: 15,
          max: 15,
          criteria:
            "Coach states commitments out loud (\"I'll get you feedback on ___ by ___.\"). Client commitments are specific (\"Film ___ by ___.\" / \"Complete ___ daily.\"). Client owns a weekly theme in their own words. If client is slipping, coach creates micro-commitments. If a behavior change is noticed, coach calls it out subtly. Both sides know exactly what's expected.",
        },
        {
          label: "Strong",
          min: 10,
          max: 10,
          criteria: "Clear commitments but lacks specific deadlines or measurability. One side more accountable than the other. Client commitment present but vague.",
        },
        {
          label: "Mid",
          min: 5,
          max: 5,
          criteria: "Vague action steps: \"Do your workouts,\" \"Let me know how it goes.\" No deadline, no specific task. No verbal ownership.",
        },
        {
          label: "Fail",
          min: 0,
          max: 0,
          criteria: "No clear next steps for either party. Call ends without accountability.",
        },
      ],
      positiveSignals: [
        "Client repeats back their commitment",
        "Both sides have a named task + deadline",
        "Coach calls out a behavior pattern change",
        "Micro-commitment created for slipping client",
      ],
      negativeSignals: ["\"Keep doing what you're doing\"", "No named task", "No deadline", "Generic coaching around commitment", "Coach never follows up on previous call's commitment"],
      calibrationNotes: [
        "\"We can run into this danger zone where we're trying to care more about their journey than they do... getting clients to verbally commit and take ownership.\"",
        "#2 loss dimension: \"Most coaches say 'great, keep it up' instead of creating owned commitments on both sides.\"",
      ],
    },
    {
      id: "D7",
      name: "Accountability Anchor",
      maxScore: 5,
      whatToLookFor:
        "Is there a clear, non-negotiable accountability commitment the client owns for the week - one that is gated to a coach action (program progression, feedback)? Best as ONE named anchor task, but a specific, verifiable, progression-gated deliverable the client confirms also qualifies, even when several items are requested.",
      bands: [
        {
          label: "Elite",
          min: 5,
          max: 5,
          criteria:
            "A clear accountability commitment the client owns and verbally confirms, gated to the coach's next action (program adjustment, feedback) - a real chain of consequence. Either (a) one explicitly-named anchor, or (b) a specific, verifiable deliverable the client must submit before the coach progresses (even if several items are listed), as long as the deliverable and consequence are clear and confirmed. Time-bound is satisfied by a hard date OR a session-relative deadline (\"before our next call\").",
        },
        {
          label: "Mid",
          min: 3,
          max: 3,
          criteria: "Accountability gestured at but NOT clearly gated to a coach action/consequence - tasks listed with equal weight and no clear \"what this unlocks\", or unclear what the client actually owns.",
        },
        {
          label: "Fail",
          min: 0,
          max: 0,
          criteria: "No accountability anchor. Multiple vague tasks or nothing at all.",
        },
      ],
      positiveSignals: [
        "Coach names \"your one accountability task is...\"",
        "A specific deliverable the client confirms (\"Absolutely\")",
        "The deliverable is gated to the coach's next output (progression, feedback)",
        "A clear submission window (\"before I progress you\", \"over the next two weeks\")",
      ],
      negativeSignals: ["Vague commitments with no clear consequence", "Client uncertain what they actually owe", "No accountability deliverable stated before close", "Tasks with no link to any coach action"],
      calibrationNotes: [
        "The next-call booking functions as a dual accountability layer - it does not substitute for this dimension's anchor, and vice versa.",
        "(Devin -> Owen, May 2026): \"send some videos over the next two weeks... I need to see these before I progress you,\" client confirms (\"Absolutely\") is a satisfied accountability anchor (Strong-Elite) even though several videos are listed and the deadline is a window rather than a single date. Do NOT cap or downgrade purely because it was framed as a set of videos or used a session-relative deadline.",
      ],
    },
    {
      id: "D8",
      name: "Struggle Handling",
      maxScore: 5,
      whatToLookFor:
        "When the client reveals difficulty - physical, emotional, motivational, or frustration with the program - does the coach actually coach through it, or just acknowledge it? If NO struggle is present in the call, score 5/5 by default (not penalized for a smooth call). Auto-cap: struggle present but ignored/avoided -> 0/5, non-recoverable.",
      bands: [
        {
          label: "Elite",
          min: 5,
          max: 5,
          criteria:
            "Coach does NOT defend, prove, or take the struggle personally. Stays grounded and fact-based. Asks questions to get to the core before offering solutions. Pre-frames if client is upset, reconnects to why, reframes (\"We do not stop - we shift\"), goes full circle, offers options. Client leaves feeling more capable and reconnected - not just heard.",
        },
        {
          label: "Mid",
          min: 3,
          max: 3,
          criteria: "Acknowledges struggle and offers some support. Asks some questions but doesn't fully coach through or reconnect to why. Brief or surface-level reassurance.",
        },
        {
          label: "Fail",
          min: 0,
          max: 0,
          criteria: "Struggle ignored, minimized, avoided, or coach becomes defensive.",
        },
      ],
      positiveSignals: [
        "Coach asks multiple questions before offering solutions",
        "Client tone visibly shifts mid-section",
        "Coach references original why from kickoff",
        "Goes full circle",
        "Offers multiple options and commits to one",
      ],
      negativeSignals: ["\"Don't worry about it, everyone goes through this\"", "Defending the program", "Using client's negative language", "Moving on without resolution"],
      calibrationNotes: [
        "Marcus's live roleplay (upset client, R.M.): don't use the client's negative words back at them; stay fact-based; don't defend the program - ask questions until the client solves it themselves; full-circle close (\"is there anything I could be doing differently as your coach?\"); offer options and commit to one with a timeline; pre-frame if you know they're upset.",
      ],
    },
    {
      id: "D9",
      name: "Close Quality",
      maxScore: 5,
      whatToLookFor: "Does the call end with emotional energy, specific celebration, and directional clarity - or just logistics?",
      bands: [
        {
          label: "Elite",
          min: 5,
          max: 5,
          criteria:
            "Celebrates a specific, named progress from THIS call (\"The way you pushed through ___ shows you're building ___.\"). Reiterates direction (\"This block leads directly into your ___ milestone.\"). Warm, earned close. Client leaves energized, not just satisfied.",
        },
        {
          label: "Mid",
          min: 3,
          max: 3,
          criteria: "Positive close with some specificity but generic celebration (\"You're doing great\") or flat close without direction. Client leaves satisfied but not energized.",
        },
        {
          label: "Fail",
          min: 0,
          max: 0,
          criteria: "Abrupt end. Client leaves without emotional reinforcement or directional clarity.",
        },
      ],
      positiveSignals: ["Celebration references something specific from THIS call", "Direction linked to next phase", "Client expresses enthusiasm or gratitude"],
      negativeSignals: ["Generic \"good job\"", "No specific event referenced", "Flat tone", "Close rushed because booking ran late"],
      calibrationNotes: [
        "A written breakdown some coaches send post-call is a post-call extension, not a substitute for the in-call close - the in-call close must still land.",
        "#4 loss dimension: \"No emotional reinforcement at the close.\" Common even in strong coaches.",
      ],
    },
    {
      id: "D10",
      name: "Next Call Booking",
      maxScore: 5,
      whatToLookFor:
        "Is the next call booked LIVE before the call ends? Non-negotiable - binary dimension, no partial credit band. Auto-cap makes this explicit: not booked live -> 0/5, non-recoverable, regardless of any other context.",
      bands: [
        {
          label: "Elite",
          min: 5,
          max: 5,
          criteria:
            "Booked live on call (non-negotiable met). Booking link shared live. Client books during the call. Date confirmed verbally (\"I see you booked for ___. We're locked in.\"). Happens before the close.",
        },
        {
          label: "Fail",
          min: 0,
          max: 0,
          criteria: "Not booked. Call ends without next call locked in live. Automatic 0, non-recoverable.",
        },
      ],
      positiveSignals: ["Date confirmed verbally", "\"We're locked in\"", "Booking completed before close begins"],
      negativeSignals: ["\"I'll send you the link later\"", "Call ends without booking", "\"Message me when you're free.\""],
      calibrationNotes: [
        "\"Book your next call on the call. Always. I don't care if you're at minute 29... 100% of the time needs to happen.\" Non-negotiable.",
        "Retention mechanic: the booked call itself functions as an accountability layer independent of D7's anchor - neither substitutes for the other.",
      ],
    },
    {
      id: "D11",
      name: "Continuity & Follow-Up Clarity",
      maxScore: 5,
      whatToLookFor: "Does the client know EXACTLY what happens after this call ends - what the coach will do, when, and how?",
      bands: [
        {
          label: "Elite",
          min: 5,
          max: 5,
          criteria:
            "Coach restates the accountability anchor explicitly. States their own follow-up with specific timing (\"Once you send ___, I'll get you feedback by ___.\"). Client can answer 'what happens next?' without hesitation. Chain is clear: client does X by Y -> coach delivers Z by W.",
        },
        {
          label: "Mid",
          min: 3,
          max: 3,
          criteria: "Follow-up mentioned but vague timing (\"I'll send you feedback this week\"). Anchor partially restated. Client unsure exactly what to expect or when.",
        },
        {
          label: "Fail",
          min: 0,
          max: 0,
          criteria: "No post-call structure. Call ends with zero continuity visible.",
        },
      ],
      positiveSignals: ["Coach gives specific day for their deliverable", "Accountability anchor restated in closing", "Clear cause-and-effect chain between client action and coach response"],
      negativeSignals: ["\"I'll check in\"", "\"Message me if you need anything\"", "No timeline on coach's deliverable"],
    },
    {
      id: "D12",
      name: "Structure & Time Management",
      maxScore: 5,
      whatToLookFor: "Did the call feel intentional and controlled - or scattered, rushed, or bloated?",
      bands: [
        {
          label: "Elite",
          min: 5,
          max: 5,
          criteria:
            "Call flows naturally through all applicable SOP sections. Pacing smooth - not rushed, not padded. Close and booking don't feel rushed. Client never confused about where the call is going. Framework is woven in, not announced.",
        },
        {
          label: "Mid",
          min: 3,
          max: 3,
          criteria: "Slightly uneven pacing. Most sections covered. One section rushed or bloated, or 1 key section compressed to under 30 seconds.",
        },
        {
          label: "Fail",
          min: 0,
          max: 0,
          criteria: "Disorganized. Core sections missing. Flow unclear to observer and probably to client.",
        },
      ],
      positiveSignals: ["Natural transitions between sections", "Close doesn't feel rushed", "No section noticeably absent"],
      negativeSignals: ["Close rushed because time ran out", "Accountability section skipped", "Booking feels like an afterthought", "Coach loses track of flow mid-call"],
      calibrationNotes: [
        "\"Don't make it robotic... Start to weave it into the fabric of your coaching.\" Robotic section announcements are a MID signal, not an ELITE signal.",
        "At weeks 8/16/24 (diagnostic milestones), more time on D2/D3 is expected - pacing evaluated relative to call type.",
      ],
    },
  ],
};
