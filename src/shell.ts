export type ShellFlavor = "powershell" | "cmd" | "posix" | "unknown";

export type ShellGuidance = {
  detectedShell: ShellFlavor;
  recommendedEntrypoint: string;
  alternativeEntrypoints: {
    cmd: string;
    powershell: string;
    posix: string;
  };
  recommendedCommands: {
    status: string;
    watchOnce: string;
    lookup: string;
  };
};

function normalizeShellValue(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function detectShellFlavor(
  env: Record<string, string | undefined> = process.env,
  platform: NodeJS.Platform = process.platform
): ShellFlavor {
  const shell = normalizeShellValue(env.SHELL);
  const msystem = normalizeShellValue(env.MSYSTEM);
  const termProgram = normalizeShellValue(env.TERM_PROGRAM);
  const comSpec = normalizeShellValue(env.ComSpec ?? env.COMSPEC);
  const psModulePath = normalizeShellValue(env.PSModulePath);

  if (shell.includes("bash") || shell.includes("zsh") || shell.includes("sh") || shell.includes("fish")) {
    return "posix";
  }
  if (msystem.length > 0 || termProgram.includes("git-bash")) {
    return "posix";
  }
  if (shell.includes("pwsh") || shell.includes("powershell")) {
    return "powershell";
  }
  if (psModulePath.length > 0 && platform === "win32") {
    return "powershell";
  }
  if (comSpec.includes("cmd.exe")) {
    return "cmd";
  }
  if (platform !== "win32") {
    return "posix";
  }
  return "unknown";
}

export function getShellGuidance(
  root: string,
  options: {
    env?: Record<string, string | undefined>;
    platform?: NodeJS.Platform;
  } = {}
): ShellGuidance {
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const detectedShell = detectShellFlavor(env, platform);
  const cmdEntrypoint = ".\\.symballist\\bin\\symballist.cmd";
  const powershellEntrypoint = ".\\.symballist\\bin\\symballist.ps1";
  const posixEntrypoint = "./.symballist/bin/symballist";

  const recommendedEntrypoint = detectedShell === "posix"
    ? posixEntrypoint
    : detectedShell === "powershell"
      ? powershellEntrypoint
      : cmdEntrypoint;

  return {
    detectedShell,
    recommendedEntrypoint,
    alternativeEntrypoints: {
      cmd: cmdEntrypoint,
      powershell: powershellEntrypoint,
      posix: posixEntrypoint
    },
    recommendedCommands: {
      status: `${recommendedEntrypoint} status --root ${root}`,
      watchOnce: `${recommendedEntrypoint} watch --once --root ${root}`,
      lookup: `${recommendedEntrypoint} lookup "<text>" --root ${root}`
    }
  };
}
