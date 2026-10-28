import io.joern.dataflowengineoss.language.*
import io.shiftleft.semanticcpg.language.*

@main def exec(cpgFile: String, outFile: String) = {
  importCpg(cpgFile)
  run.ossdataflow
  val language = cpg.metaData.language.l.headOption.getOrElse("")
  val sourceCodes = Set("request.query.command", "request.query.argument",
    "request.args[\"command\"]", "request.args[\"argument\"]")
  val sources = cpg.call.filter(call => sourceCodes.contains(call.code)).l
  val shellCalls = cpg.call.name("execSync").l ++ cpg.call.name("run").filter(call =>
    call.argument.exists(argument => argument.argumentName.contains("shell") && argument.code == "True")
  ).l
  val sinks = shellCalls.flatMap(_.argument(1)).toList
  val flows = sinks.iterator.reachableByFlows(sources.iterator).l
  val result = ujson.Obj(
    "language" -> language,
    "files" -> ujson.Arr.from(cpg.file.name.l.sorted),
    "methods" -> cpg.method.isExternal(false).size,
    "calls" -> cpg.call.size,
    "sources" -> ujson.Arr.from(sources.map(_.code)),
    "sinks" -> ujson.Arr.from(sinks.map(_.code)),
    "shellCalls" -> ujson.Arr.from(shellCalls.map(_.code)),
    "flows" -> ujson.Arr.from(flows.map(flow => ujson.Arr.from(flow.elements.map(node =>
      ujson.Obj("code" -> node.code, "line" -> node.lineNumber.getOrElse(-1),
        "file" -> node.file.name.headOption.getOrElse(""))
    ))))
  )
  java.nio.file.Files.writeString(java.nio.file.Path.of(outFile), ujson.write(result, indent = 2))
}
