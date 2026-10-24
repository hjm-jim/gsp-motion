using System;
using System.IO;
using System.Text;
using System.Diagnostics;
public static class Launcher {
  // Windows CommandLineToArgvW quoting: preserve spaces, quotes and trailing backslashes.
  static string Quote(string value) {
    StringBuilder b=new StringBuilder("\""); int slashes=0;
    foreach(char c in value) {
      if(c=='\\') { slashes++; continue; }
      if(c=='"') { b.Append('\\',slashes*2+1); b.Append('"'); }
      else { b.Append('\\',slashes); b.Append(c); }
      slashes=0;
    }
    b.Append('\\',slashes*2); b.Append('"'); return b.ToString();
  }
  public static int Main(string[] args) {
    try {
      Console.OutputEncoding=new UTF8Encoding(false);
      string root=AppDomain.CurrentDomain.BaseDirectory;
      if(!File.Exists(Path.Combine(root,"tool","cli.cjs"))) {
        root=File.ReadAllText(Path.Combine(root,"gsp-motion.home"),Encoding.UTF8).Trim();
      }
      StringBuilder command=new StringBuilder(Quote(Path.Combine(root,"tool","cli.cjs")));
      foreach(string arg in args) { command.Append(' '); command.Append(Quote(arg)); }
      ProcessStartInfo start=new ProcessStartInfo(Path.Combine(root,"runtime","node.exe"),command.ToString());
      start.UseShellExecute=false; start.CreateNoWindow=true;
      start.RedirectStandardOutput=true; start.RedirectStandardError=true;
      start.StandardOutputEncoding=new UTF8Encoding(false);start.StandardErrorEncoding=new UTF8Encoding(false);
      start.EnvironmentVariables["GSP_SHARP_MODULE"]=Path.Combine(root,"node_modules","sharp");
      start.EnvironmentVariables["FFMPEG_PATH"]=Path.Combine(root,"runtime","ffmpeg.exe");
      using(Process child=new Process()) {
        child.StartInfo=start;
        child.OutputDataReceived+=(sender,e)=>{if(e.Data!=null)Console.Out.WriteLine(e.Data);};
        child.ErrorDataReceived+=(sender,e)=>{if(e.Data!=null)Console.Error.WriteLine(e.Data);};
        child.Start();child.BeginOutputReadLine();child.BeginErrorReadLine();
        child.WaitForExit(); return child.ExitCode;
      }
    } catch(Exception ex) {
      // Errors from the launcher also use a machine-readable stdout record.
      string message=ex.Message.Replace("\\","\\\\").Replace("\"","\\\"").Replace("\r","\\r").Replace("\n","\\n");
      Console.WriteLine("{\"ok\":false,\"error\":{\"message\":\""+message+"\"}}");return 1;
    }
  }
}
