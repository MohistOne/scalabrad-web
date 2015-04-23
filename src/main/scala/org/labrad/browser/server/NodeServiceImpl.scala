package org.labrad.browser.server

import java.util.concurrent.ExecutionException

import javax.inject.Singleton
import javax.servlet.ServletContext
import scala.concurrent.Future
import scala.concurrent.ExecutionContext.Implicits.global
import scala.concurrent.duration._

import org.labrad.Connection
import org.labrad.browser.client.message.{NodeServerStatus, NodeStatusMessage}
import org.labrad.browser.client.nodes.{NodeRequestError, NodeService}
import org.labrad.data._
import org.labrad.util.Logging

object NodeServiceImpl {
  def getServerStatuses(servers: Data): Array[NodeServerStatus] = {
    servers.get[Array[Data]].map(getServerStatus)
  }

  private def getServerStatus(statusData: Data): NodeServerStatus = {
    val (name, desc, ver, instName, env, instances) = statusData.get[(String, String, String, String, Array[String], Array[String])]
    new NodeServerStatus(name, desc, ver, instName, env, instances)
  }
}

@Singleton
class NodeServiceImpl extends AsyncServlet with NodeService with Logging {

  def getNodeInfo: Array[NodeStatusMessage] = Array() /*future {
    (for {
      serverData <- LabradConnection.getManager.servers()
      servers = serverData.map { case (id, name) => name }

      nodes <- Future.sequence {
        for (server <- servers if server.toLowerCase.startsWith("node")) yield
          LabradConnection.to(server).call("status").map((server, _))
      }
      statuses = nodes.map { case (server, status) =>
        new NodeStatusEvent(server, NodeServiceImpl.getServerStatuses(status))
      }
    } yield statuses.toArray).recover(oops("", "", "get_node_info"))
  }*/

  def refreshServers(node: String): String = future {
    log.info(s"refreshServers. node=$node")
    LabradConnection.to(node).call("refresh_servers").map(_ => "").recover(oops(node, "", "refresh_servers"))
  }

  def restartServer(node: String, server: String): String = doRequest(node, server, "restart")
  def startServer(node: String, server: String): String = doRequest(node, server, "start")
  def stopServer(node: String, server: String): String = doRequest(node, server, "stop")

  private def doRequest(node: String, server: String, action: String): String = future {
    val cxn = LabradConnection.get
    val ctx = cxn.newContext
    val pkt = LabradConnection.to(node).packet(ctx)
    val req = pkt.call(action, Str(server))
    pkt.send
    req.map(_.getString).recover(oops(node, server, action))
  }

  private def oops(node: String, server: String, action: String): PartialFunction[Throwable, Nothing] = {
    case e: ExecutionException =>
      throw new NodeRequestError(node, server, action, e.getCause.getMessage)
    case e: Throwable =>
      throw new NodeRequestError(node, server, action, e.getMessage)
  }

}
