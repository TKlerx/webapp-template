import io.shiftleft.semanticcpg.language.*
@main def audit(cpgFile: String, outFile: String) = {
  importCpg(cpgFile)
  val result = ujson.Obj(
    "parameters" -> ujson.Arr.from(cpg.method.parameter.name("request|job").l.map(p => ujson.Obj("method" -> p.method.name, "code" -> p.code, "type" -> p.typeFullName))),
    "calls" -> ujson.Arr.from(cpg.call.filter(c => c.name == "claim_next_job" || c.name == "JobStore" || c.code == "job.payload").l.map(c => ujson.Obj("name" -> c.name, "code" -> c.code, "method" -> c.method.name, "full" -> c.methodFullName, "args" -> ujson.Arr.from(c.argument.l.map(a => ujson.Obj("code" -> a.code, "index" -> a.argumentIndex))))))
  )
  java.nio.file.Files.writeString(java.nio.file.Path.of(outFile), ujson.write(result, indent=2))
}
