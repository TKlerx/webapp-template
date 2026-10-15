// SPDX-License-Identifier: MIT
// Adapted from GitHub CodeQL CommandInjection query/customization and process models.
// Copyright (c) 2006-2025 GitHub, Inc. See LICENSE-CodeQL and README.md.
// Bounded port: Express/Flask, typed Web/Next.js requests, and worker job inputs;
// Node child_process command argument, Python subprocess command/executable arguments.
import io.shiftleft.semanticcpg.language.*
import io.joern.dataflowengineoss.language.*
import io.shiftleft.codepropertygraph.generated.nodes.*

@main def commandInjection(cpgFile: String, outFile: String) = {
  importCpg(cpgFile)
  run.ossdataflow
  val language = cpg.metaData.language.head
  require(Set("JSSRC", "PYTHONSRC").contains(language), s"Unsupported language: $language")
  def file(node: AstNode): String = node.file.name.headOption.getOrElse("")
  def location(node: AstNode) = ujson.Obj("file" -> file(node), "line" -> node.lineNumber.getOrElse(-1), "code" -> node.code)

  // CodeQL uses framework/threat-model sources; port only the framework surfaces
  // exercised here. Parameter names alone never make all helper inputs tainted.
  val flaskRequests = cpg.imports.filter(_.importedEntity.contains("flask.request")).l
  val legacySources = cpg.call.name("<operator>.fieldAccess|<operator>.indexAccess").filter { call =>
    if (language == "JSSRC") {
      val root = call.code.takeWhile(_ != '.')
      Set("req", "request").contains(root) && call.method.parameter.nameExact(root).nonEmpty &&
        (!call.method.parameter.nameExact(root).exists(p => p.typeFullName.matches("(?:.*[.:])?(?:NextRequest|Request)")) ||
          cpg.imports.exists(i => file(i) == file(call) && i.importedEntity.exists(entity =>
            entity == "express:Request" || entity == "express-serve-static-core:Request"))) &&
        call.code.matches("(?:req|request)\\.(?:query|body|params|headers|cookies)(?:\\..+|\\[.+\\])")
    } else {
      flaskRequests.exists { requestImport =>
        file(requestImport) == file(call) && call.code.matches(
          java.util.regex.Pattern.quote(requestImport.importedAs.getOrElse("request")) +
          "\\.(?:args|form|values|json|headers|cookies)(?:\\..+|\\[.+\\])"
        )
      }
    }
  }.l

  // Next.js/Web Request inputs: model values returned by readers, not references
  // to get/trim methods. Type annotations anchor the receiver to a request.
  def requestNames(call: Call) = call.method.parameter.filter(p =>
    p.typeFullName.matches("(?:.*[.:])?(?:NextRequest|Request)") ||
      p.code.matches("(?s).*:\\s*(?:NextRequest|Request)\\b.*")
  ).name.l
  def isBodyHelper(call: Call) = Set("parseJsonBody", "parseFormBody").contains(call.name) &&
    cpg.imports.exists(i => file(i) == file(call) &&
      i.importedEntity.exists(entity => entity.endsWith(s"lib/validation:${call.name}")))
  val nextSources = if (language != "JSSRC") Nil else cpg.call.l.flatMap { call =>
    val names = requestNames(call)
    val reader = names.exists { name =>
      val receiver = java.util.regex.Pattern.quote(name)
      call.code.matches(receiver + "\\.(?:json|formData|text|arrayBuffer)\\(.*") ||
        call.code.matches(receiver + "\\.(?:headers|cookies)\\.(?:get|getAll)\\(.*") ||
        call.code.matches(receiver + "\\.nextUrl\\.searchParams\\.(?:get|getAll)\\(.*")
    }
    val url = call.name == "<operator>.fieldAccess" && names.exists(name => call.code == s"$name.url")
    val cookieValue = call.name == "<operator>.fieldAccess" && names.exists(name =>
      call.code.matches(java.util.regex.Pattern.quote(name) + "\\.cookies\\.get\\(.*\\)!?\\.value"))
    val routeParams = call.name == "<operator>.fieldAccess" && names.nonEmpty &&
      call.method.parameter.exists(p => p.code.contains("params") && call.code == s"${p.name}.params")
    val helper = isBodyHelper(call)
    val helperValue = call.name == "<operator>.fieldAccess" &&
      call.method.ast.isCall.name("<operator>.assignment").exists { assignment =>
        assignment.argument.filter(_.argumentIndex == 1).exists { target =>
          (call.code == s"${target.code}.data" || call.code.startsWith(s"${target.code}.data.")) &&
            assignment.argument.filter(_.argumentIndex == 2).ast.isCall.exists(isBodyHelper)
        }
      }
    if (reader && !call.name.startsWith("<operator>")) List((call, "nextjs.reader"))
    else if (cookieValue) List((call, "nextjs.cookie-value"))
    else if (url || routeParams) List((call, "nextjs.url-or-params"))
    else if (helper || helperValue) List((call, "nextjs.validated-body-helper"))
    else Nil
  }

  // BackgroundJob.payload is a trust boundary. Pydantic shape validation does
  // not sanitize shell commands. Other objects' payload fields are not sources.
  val workerSources = if (language != "PYTHONSRC") Nil else cpg.call.filter { call =>
    val root = call.code.takeWhile(_ != '.')
    val payloadRead = call.code == s"$root.payload" || call.code.startsWith(s"$root.payload[") ||
      (call.name == "get" && call.code.startsWith(s"$root.payload.get("))
    if (!payloadRead) false else {
      val assignments = call.method.ast.isCall.name("<operator>.assignment").l
      val typedJob = call.method.parameter.exists(p => p.name == root && p.typeFullName.endsWith("BackgroundJob"))
      val claimedJob = assignments.exists { assignment =>
        assignment.argument.exists(arg => arg.argumentIndex == 1 && arg.code == root) &&
          assignment.argument.filter(_.argumentIndex == 2).ast.isCall.exists { claim =>
            claim.name == "claim_next_job" && claim.argument.filter(_.argumentIndex == 0).exists { receiver =>
              call.method.parameter.exists(p => p.name == receiver.code && p.typeFullName.endsWith("JobStore")) ||
                assignments.exists { binding =>
                  binding.argument.exists(arg => arg.argumentIndex == 1 && arg.code == receiver.code) &&
                    binding.argument.filter(_.argumentIndex == 2).ast.isCall.exists(c =>
                      c.methodFullName.endsWith("db.py:<module>.JobStore.__init__"))
                }
            }
          }
      }
      typedJob || claimedJob
    }
  }.l.map(call => (call, "worker.job-payload"))
  val modeledSources = (legacySources.map(call => (call, "legacy.http")) ++ nextSources ++ workerSources)
    .groupBy(_._1.id).values.map(_.head).toList
  val sourceKinds = modeledSources.map { case (node, kind) => node.id -> kind }.toMap
  val sources = modeledSources.map(_._1)

  val processCalls = cpg.call.filter { call =>
    if (language == "JSSRC")
      call.methodFullName.matches("(?:node:)?child_process:(?:exec|execSync|execFile|execFileSync|spawn|spawnSync|fork)")
    else
      call.methodFullName.matches("subprocess\\.py:<module>\\.(?:Popen|call|check_call|check_output|run|getoutput|getstatusoutput)")
  }.l

  def commandArguments(call: Call): List[Expression] = {
    if (language == "JSSRC") call.argument.filter(_.argumentIndex == 1).l
    else {
      val executable = call.argument.filter(_.argumentName.contains("executable")).l
      val args = call.argument.filter(arg => arg.argumentName.contains("args") || arg.argumentIndex == 1).l
      val shellEnabled = call.argument.exists(arg => arg.argumentName.contains("shell") && arg.code == "True")
      // Mirrors CodeQL Stdlib: executable override is a sink; a literal sequence
      // contributes its first element, not all ordinary arguments. Dynamic lists
      // remain coarse sinks, like the source model's fallback.
      val commands = if (executable.nonEmpty && !shellEnabled) Nil else args.flatMap { arg =>
        if (arg.code.startsWith("[") || arg.code.startsWith("(")) arg.iterator.isCall.argument(1).l
        else List(arg)
      }
      executable ++ commands
    }
  }

  val candidates = processCalls.flatMap(call => commandArguments(call).map(arg => (call, arg)))
  val findings = candidates.flatMap { case (call, argument) =>
    argument.iterator.reachableByFlows(sources.iterator).l.map { flow =>
      ujson.Obj("ruleId" -> (if (language == "JSSRC") "js/command-line-injection" else "py/command-line-injection"),
        "sourceModel" -> sourceKinds.getOrElse(flow.elements.head.id, "unknown"),
        "sink" -> location(call), "commandArgument" -> location(argument),
        "path" -> ujson.Arr.from(flow.elements.map(location)))
    }
  }.groupBy(finding => ujson.write(finding("sink")) + ujson.write(finding("path")(0))).values.map(_.head).toList
  val result = ujson.Obj("language" -> language, "scope" -> "bounded CodeQL-derived port",
    "files" -> ujson.Arr.from(cpg.file.name.l.sorted),
    "methods" -> cpg.method.isExternal(false).size,
    "calls" -> cpg.call.size,
    "sources" -> ujson.Arr.from(modeledSources.map { case (node, kind) =>
      val loc = location(node); loc("model") = ujson.Str(kind); loc
    }),
    "processCalls" -> ujson.Arr.from(processCalls.map(location)),
    "commandArguments" -> ujson.Arr.from(candidates.map(pair => location(pair._2))),
    "findings" -> ujson.Arr.from(findings))
  java.nio.file.Files.writeString(java.nio.file.Path.of(outFile), ujson.write(result, indent = 2))
}
